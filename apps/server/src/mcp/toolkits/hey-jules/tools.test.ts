import { expect, it } from "@effect/vitest";
import * as Context from "effect/Context";
import { Tool } from "effect/unstable/ai";

import {
  HeyJulesCommitCalendarEventTool,
  HeyJulesGetDayContextTool,
  HeyJulesToolkit,
} from "./tools.ts";

const schemaHasDescription = (schema: unknown): boolean => {
  if (!schema || typeof schema !== "object") return false;
  const record = schema as Record<string, unknown>;
  if (typeof record.description === "string" && record.description.length > 0) return true;
  return [record.anyOf, record.oneOf, record.allOf]
    .filter(Array.isArray)
    .some((members) => members.some(schemaHasDescription));
};

it("exports provider-compatible object schemas with described parameters", () => {
  for (const tool of Object.values(HeyJulesToolkit.tools)) {
    const schema = Tool.getJsonSchema(tool) as {
      readonly type?: unknown;
      readonly properties?: Readonly<Record<string, unknown>>;
    };

    expect(schema.type).toBe("object");
    for (const [field, fieldSchema] of Object.entries(schema.properties ?? {})) {
      expect(
        schemaHasDescription(fieldSchema),
        `${tool.name}.${field} should explain what data the agent must pass`,
      ).toBe(true);
    }
  }
});

it("keeps reads safe and calendar writes explicitly approval-gated", () => {
  expect(Context.get(HeyJulesGetDayContextTool.annotations, Tool.Readonly)).toBe(true);
  expect(Context.get(HeyJulesGetDayContextTool.annotations, Tool.Destructive)).toBe(false);
  expect(Context.get(HeyJulesCommitCalendarEventTool.annotations, Tool.Readonly)).toBe(false);
  expect(Context.get(HeyJulesCommitCalendarEventTool.annotations, Tool.Destructive)).toBe(true);
  expect(Context.get(HeyJulesCommitCalendarEventTool.annotations, Tool.Idempotent)).toBe(false);
  expect(HeyJulesCommitCalendarEventTool.needsApproval).toBe(true);
});
