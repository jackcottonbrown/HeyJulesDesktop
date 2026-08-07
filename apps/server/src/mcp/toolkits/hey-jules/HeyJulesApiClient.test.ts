import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import {
  commitHeyJulesCalendarEvent,
  getHeyJulesDayContext,
  resolveHeyJulesApiConfig,
} from "./HeyJulesApiClient.ts";

const environment = {
  HEY_JULES_API_URL: "https://jules.example.test",
  HEY_JULES_API_TOKEN: "secret-token",
};

it("accepts HTTPS and loopback HTTP endpoints but rejects remote plaintext URLs", () => {
  expect(resolveHeyJulesApiConfig(environment)?.baseUrl.href).toBe("https://jules.example.test/");
  expect(
    resolveHeyJulesApiConfig({
      HEY_JULES_API_URL: "http://127.0.0.1:3000",
      HEY_JULES_API_TOKEN: "token",
    }),
  ).toBeDefined();
  expect(
    resolveHeyJulesApiConfig({
      HEY_JULES_API_URL: "http://jules.example.test",
      HEY_JULES_API_TOKEN: "token",
    }),
  ).toBeUndefined();
});

it.effect("loads a scoped day briefing with the configured bearer credential", () =>
  Effect.gen(function* () {
    let request: Request | undefined;
    const result = yield* getHeyJulesDayContext(
      { date: "2026-08-08" },
      {
        environment,
        fetcher: async (input, init) => {
          request = new Request(input.href, init);
          return Response.json({
            date: "2026-08-08",
            dayLabel: "Saturday, 8 August 2026",
            timezone: "Australia/Brisbane",
            briefing: "Real planning context",
            counts: { calendarEvents: 2, activities: 4, goals: 1, lifeContext: 3 },
          });
        },
      },
    );

    expect(result.briefing).toBe("Real planning context");
    expect(request?.url).toContain("/api/desktop/v1/context?date=2026-08-08");
    expect(request?.headers.get("authorization")).toBe("Bearer secret-token");
  }),
);

it.effect("marks calendar writes approved only inside the destructive MCP handler", () =>
  Effect.gen(function* () {
    let payload: unknown;
    const result = yield* commitHeyJulesCalendarEvent(
      {
        title: "Prototype planning block",
        start: "2026-08-08T09:00:00+10:00",
        end: "2026-08-08T10:00:00+10:00",
        category: "work",
        commitmentLevel: "firm",
      },
      {
        environment,
        fetcher: async (_input, init) => {
          payload = JSON.parse(String(init?.body));
          return Response.json(
            {
              event: {
                id: "desktop-event",
                title: "💼 Prototype planning block",
                start: "2026-08-08T09:00:00+10:00",
                end: "2026-08-08T10:00:00+10:00",
                location: null,
                htmlLink: null,
              },
            },
            { status: 201 },
          );
        },
      },
    );

    expect(payload).toMatchObject({ approved: true, title: "Prototype planning block" });
    expect(result.event.id).toBe("desktop-event");
  }),
);

it.effect("fails closed before network access when the connection is unconfigured", () =>
  Effect.gen(function* () {
    let called = false;
    const failure = yield* getHeyJulesDayContext(
      { date: "2026-08-08" },
      {
        environment: {},
        fetcher: async () => {
          called = true;
          return Response.json({});
        },
      },
    ).pipe(Effect.flip);

    expect(failure._tag).toBe("HeyJulesApiError");
    expect(called).toBe(false);
  }),
);
