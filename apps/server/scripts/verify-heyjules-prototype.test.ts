import { expect, it } from "vite-plus/test";

import {
  formatPrototypeVerificationReport,
  verifyHeyJulesPrototype,
} from "./verify-heyjules-prototype.ts";

const providerProbe = () =>
  [
    { id: "codex", label: "Codex", installed: true, authenticated: true },
    { id: "claude", label: "Claude Code", installed: true, authenticated: false },
  ] as const;

it("verifies the read-only vertical slice without printing secrets or private briefing text", async () => {
  const secret = "top-secret-desktop-token";
  const privateBriefing = "Private calendar details that must not be printed";
  let authorization: string | null = null;

  const checks = await verifyHeyJulesPrototype({
    date: "2026-08-08",
    environment: {
      HEY_JULES_API_URL: "https://jules.example.test",
      HEY_JULES_API_TOKEN: secret,
    },
    providerProbe,
    fetcher: async (_input, init) => {
      authorization = new Headers(init?.headers).get("authorization");
      return Response.json({
        date: "2026-08-08",
        dayLabel: "Saturday, 8 August 2026",
        timezone: "Australia/Brisbane",
        briefing: privateBriefing,
        counts: { calendarEvents: 3, activities: 2, goals: 1, lifeContext: 5 },
      });
    },
  });
  const report = formatPrototypeVerificationReport(checks);

  expect(checks.every((check) => check.passed)).toBe(true);
  expect(authorization).toBe(`Bearer ${secret}`);
  expect(report).toContain("3 calendar, 2 activities, 1 goals, 5 life-context items");
  expect(report).not.toContain(secret);
  expect(report).not.toContain(privateBriefing);
});

it("fails closed without credentials and does not attempt the context request", async () => {
  let requested = false;
  const checks = await verifyHeyJulesPrototype({
    date: "2026-08-08",
    environment: {},
    providerProbe,
    fetcher: async () => {
      requested = true;
      return Response.json({});
    },
  });

  expect(requested).toBe(false);
  expect(checks.find((check) => check.name === "Scoped Hey Jules connection")?.passed).toBe(false);
  expect(checks.find((check) => check.name === "Real context read")?.passed).toBe(false);
});

it("rejects impossible calendar dates before touching providers or the network", async () => {
  let probed = false;
  await expect(
    verifyHeyJulesPrototype({
      date: "2026-02-31",
      providerProbe: () => {
        probed = true;
        return providerProbe();
      },
    }),
  ).rejects.toThrow("real calendar date");
  expect(probed).toBe(false);
});
