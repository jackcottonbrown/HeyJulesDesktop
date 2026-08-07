import { expect, it } from "@effect/vitest";

import { resolveHeyJulesToolPermissionPolicy } from "./HeyJulesToolPermissions.ts";

it("allows scoped context reads without prompting", () => {
  expect(resolveHeyJulesToolPermissionPolicy("mcp__t3-code__hey_jules_get_day_context")).toBe(
    "allow",
  );
});

it("marks calendar commits as requiring approval", () => {
  expect(resolveHeyJulesToolPermissionPolicy("mcp__t3-code__hey_jules_commit_calendar_event")).toBe(
    "require-approval",
  );
});

it("does not grant permissions to lookalike tools from another MCP server", () => {
  expect(
    resolveHeyJulesToolPermissionPolicy("mcp__untrusted__hey_jules_get_day_context"),
  ).toBeUndefined();
  expect(resolveHeyJulesToolPermissionPolicy("hey_jules_get_day_context")).toBeUndefined();
});
