#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off globalDate:off - Read-only CLI preflight probes installed provider CLIs and validates an explicit calendar date.

import * as NodeChildProcess from "node:child_process";
import * as NodePath from "node:path";
import * as NodeProcess from "node:process";
import * as NodeURL from "node:url";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { Tool } from "effect/unstable/ai";

import {
  getHeyJulesDayContext,
  type HeyJulesFetch,
  resolveHeyJulesApiConfig,
} from "../src/mcp/toolkits/hey-jules/HeyJulesApiClient.ts";
import {
  HeyJulesCommitCalendarEventTool,
  HeyJulesGetDayContextTool,
} from "../src/mcp/toolkits/hey-jules/tools.ts";
import { buildCodexDeveloperInstructions } from "../src/provider/CodexDeveloperInstructions.ts";
import { HEY_JULES_AGENT_INSTRUCTIONS } from "../src/provider/HeyJulesInstructions.ts";
import { resolveHeyJulesToolPermissionPolicy } from "../src/provider/HeyJulesToolPermissions.ts";
import { loadRepoEnv } from "../../../scripts/lib/public-config.ts";

export interface ProviderAuthenticationStatus {
  readonly id: "codex" | "claude";
  readonly label: string;
  readonly installed: boolean;
  readonly authenticated: boolean;
}

export interface PrototypeVerificationCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface VerifyPrototypeOptions {
  readonly date: string;
  readonly environment?: NodeJS.ProcessEnv;
  readonly fetcher?: HeyJulesFetch;
  readonly providerProbe?: () => ReadonlyArray<ProviderAuthenticationStatus>;
}

function runStatusCommand(command: string, args: ReadonlyArray<string>) {
  return NodeChildProcess.spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function probeLocalProviderAuthentication(): ReadonlyArray<ProviderAuthenticationStatus> {
  const codex = runStatusCommand("codex", ["login", "status"]);
  const codexOutput = `${codex.stdout ?? ""}\n${codex.stderr ?? ""}`;

  const claude = runStatusCommand("claude", ["auth", "status"]);
  let claudeAuthenticated = false;
  if (claude.status === 0) {
    try {
      const parsed = JSON.parse(claude.stdout ?? "") as { readonly loggedIn?: unknown };
      claudeAuthenticated = parsed.loggedIn === true;
    } catch {
      claudeAuthenticated = /logged\s*in/i.test(claude.stdout ?? "");
    }
  }

  return [
    {
      id: "codex",
      label: "Codex",
      installed: codex.error === undefined,
      authenticated: codex.status === 0 && /logged in/i.test(codexOutput),
    },
    {
      id: "claude",
      label: "Claude Code",
      installed: claude.error === undefined,
      authenticated: claudeAuthenticated,
    },
  ];
}

function assertCalendarDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("--date must use YYYY-MM-DD format.");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("--date must be a real calendar date.");
  }
}

function providerDetail(statuses: ReadonlyArray<ProviderAuthenticationStatus>): string {
  return statuses
    .map((status) => {
      if (!status.installed) return `${status.label} not installed`;
      return `${status.label} ${status.authenticated ? "authenticated" : "not authenticated"}`;
    })
    .join("; ");
}

export async function verifyHeyJulesPrototype(
  options: VerifyPrototypeOptions,
): Promise<ReadonlyArray<PrototypeVerificationCheck>> {
  assertCalendarDate(options.date);
  const environment = options.environment ?? (loadRepoEnv() as NodeJS.ProcessEnv);
  const providers = (options.providerProbe ?? probeLocalProviderAuthentication)();
  const config = resolveHeyJulesApiConfig(environment);
  const codexInstructions = buildCodexDeveloperInstructions("default", {
    model: "verification-model",
    reasoningEffort: "verification-effort",
  });

  const checks: PrototypeVerificationCheck[] = [
    {
      name: "Local provider authentication",
      passed: providers.some((provider) => provider.authenticated),
      detail: providerDetail(providers),
    },
    {
      name: "Scoped Hey Jules connection",
      passed: config !== undefined,
      detail:
        config === undefined
          ? "Missing or unsafe HEY_JULES_API_URL/HEY_JULES_API_TOKEN configuration."
          : "Credential present; transport is HTTPS or loopback HTTP.",
    },
    {
      name: "Read-only context boundary",
      passed:
        Context.get(HeyJulesGetDayContextTool.annotations, Tool.Readonly) === true &&
        Context.get(HeyJulesGetDayContextTool.annotations, Tool.Destructive) === false &&
        resolveHeyJulesToolPermissionPolicy("mcp__t3-code__hey_jules_get_day_context") === "allow",
      detail: "Day context is read-only, idempotent, and does not require an interruption.",
    },
    {
      name: "Consequential action boundary",
      passed:
        HeyJulesCommitCalendarEventTool.needsApproval === true &&
        Context.get(HeyJulesCommitCalendarEventTool.annotations, Tool.Destructive) === true &&
        Context.get(HeyJulesCommitCalendarEventTool.annotations, Tool.Idempotent) === false &&
        resolveHeyJulesToolPermissionPolicy("mcp__t3-code__hey_jules_commit_calendar_event") ===
          "require-approval",
      detail:
        "Calendar creation is destructive and non-idempotent; MCP metadata and the Claude callback policy require approval.",
    },
    {
      name: "Planning instructions",
      passed:
        codexInstructions.includes(HEY_JULES_AGENT_INSTRUCTIONS) &&
        HEY_JULES_AGENT_INSTRUCTIONS.includes("hey_jules_get_day_context") &&
        HEY_JULES_AGENT_INSTRUCTIONS.includes("explicitly accepted") &&
        HEY_JULES_AGENT_INSTRUCTIONS.includes("do not invent personal context"),
      detail: "The provider is instructed to read context, propose first, and fail honestly.",
    },
  ];

  if (!config) {
    checks.push({
      name: "Real context read",
      passed: false,
      detail: "Not attempted because the scoped Hey Jules connection is not configured.",
    });
    return checks;
  }

  try {
    const context = await Effect.runPromise(
      getHeyJulesDayContext(
        { date: options.date },
        { environment, ...(options.fetcher ? { fetcher: options.fetcher } : {}) },
      ),
    );
    checks.push({
      name: "Real context read",
      passed: true,
      detail: `${context.date} (${context.timezone}): ${context.counts.calendarEvents} calendar, ${context.counts.activities} activities, ${context.counts.goals} goals, ${context.counts.lifeContext} life-context items; ${context.briefing.length} briefing characters received.`,
    });
  } catch (cause) {
    const status =
      typeof cause === "object" &&
      cause !== null &&
      "status" in cause &&
      typeof cause.status === "number"
        ? ` HTTP ${cause.status}`
        : "";
    checks.push({
      name: "Real context read",
      passed: false,
      detail: `Context request failed${status}; no private response body was printed.`,
    });
  }

  return checks;
}

export function formatPrototypeVerificationReport(
  checks: ReadonlyArray<PrototypeVerificationCheck>,
): string {
  const lines = checks.map(
    (check) => `${check.passed ? "PASS" : "FAIL"}  ${check.name}: ${check.detail}`,
  );
  const passed = checks.filter((check) => check.passed).length;
  return [
    "HeyJules Desktop prototype preflight (read-only)",
    ...lines,
    `Result: ${passed}/${checks.length} checks passed.`,
  ].join("\n");
}

function parseDateArgument(args: ReadonlyArray<string>): string {
  const dateIndex = args.indexOf("--date");
  const date = dateIndex >= 0 ? args[dateIndex + 1] : undefined;
  if (!date || args.length !== 2) {
    throw new Error("Usage: pnpm run verify:prototype -- --date YYYY-MM-DD");
  }
  return date;
}

async function main(): Promise<void> {
  try {
    const checks = await verifyHeyJulesPrototype({
      date: parseDateArgument(NodeProcess.argv.slice(2)),
    });
    NodeProcess.stdout.write(`${formatPrototypeVerificationReport(checks)}\n`);
    if (checks.some((check) => !check.passed)) process.exitCode = 1;
  } catch (cause) {
    NodeProcess.stderr.write(
      `${cause instanceof Error ? cause.message : "Verification failed."}\n`,
    );
    process.exitCode = 2;
  }
}

const isMain =
  NodeProcess.argv[1] !== undefined &&
  NodeURL.pathToFileURL(NodePath.resolve(NodeProcess.argv[1])).href === import.meta.url;
if (isMain) await main();
