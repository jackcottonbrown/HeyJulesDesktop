# HeyJules Desktop

HeyJules Desktop is an experimental native macOS planning assistant that lets people use the
Codex or Claude Code subscription already authenticated on their computer. The prototype is built
from [T3 Code](https://github.com/pingdotgg/t3code), whose local provider harness, streaming,
approvals, and Electron architecture remain at its core.

The first vertical slice proves one complete interaction:

1. Jules loads the authenticated user's real planning briefing from Hey Jules.
2. The selected local provider proposes a useful daily plan.
3. Jules describes one calendar change and pauses for inline approval.
4. The approved event is created through the narrow Hey Jules companion API.

The desktop process never reads or copies provider credentials. Codex and Claude continue to own
their login state, while the Hey Jules API token remains in the local server process and is not
sent to the model.

## Prototype setup

Requirements:

- macOS with Node.js 24 and pnpm 11
- Vite+ (`vp`) available through the workspace dependencies
- Codex (`codex login`) or Claude Code (`claude auth login`)
- A running Hey Jules server with the [desktop API](docs/prototype.md) configured

Install and start the desktop app:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
# Set HEY_JULES_API_URL and HEY_JULES_API_TOKEN in .env
pnpm run dev:desktop
```

The checked-in app assets come from [`assets/heyjules/app-icon.svg`](assets/heyjules/app-icon.svg).
Maintainers can regenerate and verify every macOS, Windows, and web icon with
`pnpm run icons:export` and `pnpm run icons:check`. Regeneration requires ImageMagick
(`brew install imagemagick`); macOS supplies `iconutil`.

Fresh threads default to **Supervised**. Keep that mode enabled for the prototype so calendar
creation always appears as an inline approval before execution.

## Verification

```bash
pnpm run verify:prototype -- --date 2026-08-08
pnpm run build:desktop
pnpm run test:desktop-smoke
vp test run apps/server/src/mcp/toolkits/hey-jules/HeyJulesApiClient.test.ts
```

The prototype preflight is deliberately read-only. It confirms that at least one local provider is
authenticated, validates the MCP permission contract, and fetches real context while printing only
counts—not the bearer token or private briefing. The approved-write and rejected-write checks stay
in the manual acceptance flow because they require an explicit human decision.

The complete manual acceptance flow is documented in [docs/prototype.md](docs/prototype.md).

## Upstream and license

This repository is a fork of T3 Code and retains its Git history and MIT license. The `upstream`
remote should point to `https://github.com/pingdotgg/t3code.git`; product-specific changes are
maintained here while upstream fixes can be reviewed and integrated deliberately.

T3 Code copyright and license terms remain in [LICENSE](LICENSE).
