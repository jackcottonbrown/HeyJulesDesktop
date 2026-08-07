import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  HeyJulesApiError,
  HeyJulesCalendarEvent,
  HeyJulesDayContext,
  type HeyJulesCommitCalendarEventInput,
  type HeyJulesGetDayContextInput,
} from "./tools.ts";

export interface HeyJulesApiConfig {
  readonly baseUrl: URL;
  readonly token: string;
}

export type HeyJulesFetch = (input: URL, init?: RequestInit) => Promise<Response>;

export function resolveHeyJulesApiConfig(
  environment: NodeJS.ProcessEnv = process.env,
): HeyJulesApiConfig | undefined {
  const rawBaseUrl = environment.HEY_JULES_API_URL?.trim() ?? "";
  const token = environment.HEY_JULES_API_TOKEN?.trim() ?? "";
  if (!rawBaseUrl || !token) return undefined;

  try {
    const baseUrl = new URL(rawBaseUrl);
    const isLocalHttp =
      baseUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname.toLowerCase());
    if (baseUrl.protocol !== "https:" && !isLocalHttp) return undefined;
    if (baseUrl.username || baseUrl.password) return undefined;
    return { baseUrl, token };
  } catch {
    return undefined;
  }
}

const unconfigured = (operation: string) =>
  new HeyJulesApiError({
    operation,
    detail:
      "Hey Jules is not connected. Configure HEY_JULES_API_URL and HEY_JULES_API_TOKEN, then restart HeyJules Desktop.",
  });

const endpoint = (config: HeyJulesApiConfig, path: string): URL =>
  new URL(path, config.baseUrl.href.endsWith("/") ? config.baseUrl : `${config.baseUrl.href}/`);

const executeJson = <A>(input: {
  readonly operation: string;
  readonly url: URL;
  readonly token: string;
  readonly schema: Schema.ConstraintDecoder<A, never>;
  readonly init?: RequestInit;
  readonly fetcher: HeyJulesFetch;
}) =>
  Effect.gen(function* () {
    const body = yield* Effect.tryPromise({
      try: async () => {
        const response = await input.fetcher(input.url, {
          ...input.init,
          signal: AbortSignal.timeout(30_000),
          headers: {
            accept: "application/json",
            authorization: `Bearer ${input.token}`,
            ...input.init?.headers,
          },
        });
        if (!response.ok) {
          throw new HeyJulesApiError({
            operation: input.operation,
            status: response.status,
            detail:
              response.status === 401
                ? "Hey Jules rejected the configured desktop credential."
                : `Hey Jules returned HTTP ${response.status}.`,
          });
        }
        return response.json() as Promise<unknown>;
      },
      catch: (cause) =>
        Schema.is(HeyJulesApiError)(cause)
          ? cause
          : new HeyJulesApiError({
              operation: input.operation,
              detail: cause instanceof Error ? cause.message : "Hey Jules request failed.",
            }),
    });

    return yield* Schema.decodeUnknownEffect(input.schema)(body).pipe(
      Effect.mapError(
        (cause) =>
          new HeyJulesApiError({
            operation: input.operation,
            detail: `Hey Jules returned an invalid response: ${cause.message}`,
          }),
      ),
    );
  });

export function getHeyJulesDayContext(
  input: HeyJulesGetDayContextInput,
  options: {
    readonly environment?: NodeJS.ProcessEnv;
    readonly fetcher?: HeyJulesFetch;
  } = {},
) {
  const operation = "getDayContext";
  const config = resolveHeyJulesApiConfig(options.environment);
  if (!config) return Effect.fail(unconfigured(operation));

  const url = endpoint(config, "api/desktop/v1/context");
  url.searchParams.set("date", input.date);
  return executeJson({
    operation,
    url,
    token: config.token,
    schema: HeyJulesDayContext,
    fetcher: options.fetcher ?? globalThis.fetch,
  });
}

export function commitHeyJulesCalendarEvent(
  input: HeyJulesCommitCalendarEventInput,
  options: {
    readonly environment?: NodeJS.ProcessEnv;
    readonly fetcher?: HeyJulesFetch;
  } = {},
) {
  const operation = "commitCalendarEvent";
  const config = resolveHeyJulesApiConfig(options.environment);
  if (!config) return Effect.fail(unconfigured(operation));

  return executeJson({
    operation,
    url: endpoint(config, "api/desktop/v1/calendar/events"),
    token: config.token,
    schema: HeyJulesCalendarEvent,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, approved: true }),
    },
    fetcher: options.fetcher ?? globalThis.fetch,
  });
}
