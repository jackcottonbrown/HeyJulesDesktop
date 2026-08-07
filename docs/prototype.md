# First working prototype

## Architecture

HeyJules Desktop retains T3 Code's local execution boundary. Codex App Server and Claude Code run
as child processes under their own existing authentication. Each provider receives a short-lived,
thread-scoped credential for the desktop's local HTTP MCP server.

The MCP server exposes two product tools:

- `hey_jules_get_day_context` performs a read-only request for a pre-formatted planning briefing.
- `hey_jules_commit_calendar_event` performs one destructive, approval-gated event creation.

The local MCP handler calls the companion Hey Jules API with `HEY_JULES_API_TOKEN`. The agent sees
the tool result but never the token, database URL, calendar refresh token, or provider login files.

## Companion API configuration

The server-side implementation is maintained in the companion
[`jackcottonbrown/hey-jules` `codex/desktop-api` branch](https://github.com/jackcottonbrown/hey-jules/tree/codex/desktop-api).
It adds only the two scoped routes described below; it does not change the Hey Jules database
schema.

Configure the Hey Jules server deployment with matching values:

```dotenv
HEY_JULES_DESKTOP_API_TOKEN=<long random token>
HEY_JULES_DESKTOP_USER_ID=<Better Auth user id>
```

Configure the desktop app with:

```dotenv
HEY_JULES_API_URL=http://localhost:3000
HEY_JULES_API_TOKEN=<same long random token>
```

Use HTTPS for a remote Hey Jules deployment. The desktop rejects bearer credentials sent to a
non-loopback HTTP endpoint.

## Manual acceptance flow

1. Start Hey Jules and HeyJules Desktop.
2. Confirm Codex or Claude reports the existing subscription account as authenticated.
3. Create a fresh thread in **Supervised** mode.
4. Ask: `Plan tomorrow around what is already on my calendar.`
5. Confirm the agent calls `hey_jules_get_day_context` and cites real calendar/context details.
6. Confirm it proposes a plan without mutating the calendar.
7. Ask it to add one proposed focus block.
8. Confirm an inline approval appears for `hey_jules_commit_calendar_event` with the exact title,
   start, and end.
9. Approve it and confirm the returned event exists in Hey Jules/Google Calendar.
10. Repeat with a rejected approval and confirm no event is created.

## Prototype boundaries

This version intentionally uses one deployment-level token mapped to one user. Multi-user device
authorization, cloud fallback, remote/mobile relay, distribution signing, and notarization remain
outside the prototype. The API should move to revocable per-device credentials before distribution.

The first unsigned Apple Silicon artifact can be reproduced with:

```bash
pnpm run dist:desktop:dmg:arm64
```
