export type HeyJulesToolPermissionPolicy = "allow" | "require-approval";

const HEY_JULES_MCP_TOOL_PREFIX = "mcp__t3-code__";

const TOOL_POLICIES = {
  [`${HEY_JULES_MCP_TOOL_PREFIX}hey_jules_get_day_context`]: "allow",
  [`${HEY_JULES_MCP_TOOL_PREFIX}hey_jules_commit_calendar_event`]: "require-approval",
} as const satisfies Readonly<Record<string, HeyJulesToolPermissionPolicy>>;

/**
 * Applies product-level permissions when a provider delegates a Hey Jules tool decision to the
 * desktop callback. Unknown tools intentionally fall back to the normal runtime-mode policy.
 */
export function resolveHeyJulesToolPermissionPolicy(
  toolName: string,
): HeyJulesToolPermissionPolicy | undefined {
  return TOOL_POLICIES[toolName as keyof typeof TOOL_POLICIES];
}
