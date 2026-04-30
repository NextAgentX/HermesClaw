# HermesClaw agent notes

## Project shape
- HermesClaw is a single-package pnpm workspace (`packages: ['.']`) for an Electron + React + TypeScript + Vite desktop app integrating OpenClaw/Hermes agent chat, workflows, runtimes, models, skills, channels, and tasks.
- Use Node 24 for CI parity and pnpm 10.31.0 from `packageManager`; CI installs with `pnpm install --frozen-lockfile`.
- Main package entry is `dist-electron/main/index.js`; source boundaries are `electron/` for main/runtime/services/gateway/extensions/preload, `src/` for renderer, `resources/` for runtime resources and CLI wrappers, `scripts/` for build/package maintenance, `shared/` for cross-process constants/types, and `tests/` for unit/e2e.

## Entrypoints and process boundaries
- Renderer starts at `src/main.tsx`, calls `initializeDefaultTransports()`, and mounts React under `HashRouter`; `src/App.tsx` wires routes/providers/setup redirects/gateway transport preference and loads `src/extensions/_ext-bridge.generated`.
- Electron main starts at `electron/main/index.ts`; it creates the BrowserWindow and initializes `GatewayManager`, `ClawHubService`, host API server, extension registry, auto-start gateway, single-instance/file-lock logic, updates, and telemetry.
- Preload is `electron/preload/index.ts`; expose renderer capabilities only through the whitelisted `window.electron` `contextBridge` surface.
- Gateway ownership is in `electron/gateway/manager.ts`; WS client/protocol code is in `electron/gateway/ws-client.ts`; `ClawHubService` wraps the ClawHub CLI for skills and marketplace flows.
- Main disables hardware acceleration and has a local-gateway UI CSP/X-Frame exception for `127.0.0.1:18789`; process/file locks prevent competing gateway instances.

## Renderer host-call rules
- In `src/**/*`, do not call `window.electron.ipcRenderer.invoke` directly; use `invokeIpc` from `@/lib/api-client`.
- Do not call local `localhost` or `127.0.0.1` HTTP endpoints directly from renderer code; route through the host-api/api-client proxy layer.
- `src/lib/api-client.ts` is the intentional exception: it abstracts `ipc|ws|http`, registers default WS/HTTP invokers, and defaults host calls to IPC unless transport rules prefer otherwise.

## Commands and verification
- First setup: `pnpm run init` (`pnpm install && pnpm run uv:download`).
- Dev server: `pnpm run dev`; `predev` automatically runs `node scripts/generate-ext-bridge.mjs && zx scripts/prepare-preinstalled-skills-dev.mjs` before Vite.
- If extension bridge imports are missing or stale, run `pnpm run ext:bridge`.
- Fast build check: `pnpm run build:vite`; full distributable build: `pnpm run build` (bridge generation, Vite build, OpenClaw/plugin/preinstalled-skills bundling, then `electron-builder`).
- Focused checks: `pnpm run typecheck`, `pnpm run test`, `pnpm run test:e2e`; `pnpm run lint` is `eslint . --fix` and may mutate files.
- Vitest runs `tests/unit/**/*.{test,spec}.{ts,tsx}` in `jsdom` with globals and `tests/setup.ts`; aliases `@` and `@electron` are available.
- Playwright runs `tests/e2e` serially (`fullyParallel: false`, `workers: 1`) with 90s test timeout, 15s expect timeout, and retained trace/video/screenshots on failure; use `HERMESCLAW_E2E` and `HERMESCLAW_E2E_SKIP_SETUP` to reduce side effects in e2e flows.
- PR CI runs Node 24, frozen pnpm install, `pnpm run ext:bridge`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, and a Windows `pnpm run build:vite`; check jobs set `ELECTRON_SKIP_BINARY_DOWNLOAD=1`.
- Electron e2e CI runs `pnpm run ext:bridge`, `pnpm rebuild electron`, then `pnpm run test:e2e` (Linux via `xvfb-run -a`).

## Generated extension artifacts
- `hermesclaw-extensions.json` declares builtin main extensions (`builtin/clawhub-marketplace`, `builtin/diagnostics`).
- `scripts/generate-ext-bridge.mjs` generates `electron/extensions/_ext-bridge.generated.ts` and `src/extensions/_ext-bridge.generated.ts`; these files may be absent before `predev`/build and no-op when no external extensions exist.
- Vite reads `hermesclaw-extensions.json` so extension packages are not incorrectly externalized from the Electron main build.

## TypeScript, aliases, formatting, lint
- Aliases: `@/*` maps to `src/*`; `@electron/*` maps to `electron/*`.
- `tsconfig.json` is strict, enables unused local/parameter and fallthrough checks, uses bundler module resolution, includes only `src`, and references `tsconfig.node.json`.
- `tsconfig.node.json` is strict for `electron` and `vite.config.ts`, outputting to `dist-electron`.
- Vite uses `base: './'` for Electron `file://` production renderer; dev server port is 5173; Electron main/preload emit to `dist-electron/main` and `dist-electron/preload`.
- Prettier: semicolons, single quotes, 2 spaces, trailing comma `es5`, print width 100.
- ESLint ignores `dist/**`, `dist-electron/**`, `openclaw/**`, `release/**`, and `build/**`; `no-explicit-any` is a warning, unused variables are errors except `_`-prefixed args.

## Packaging, release, and regression gotchas
- `electron-builder.yml` outputs to `release`, packages `dist`, `dist-electron`, and `package.json`, copies `resources/`, `build/openclaw/`, and `build/preinstalled-skills/`, and runs `scripts/after-pack.cjs`.
- ASAR is enabled but unpacks `.node` files and `lru-cache`; `npmRebuild: false` because native modules belong to the separately bundled OpenClaw child process.
- Platform builds include `resources/bin/*` and CLI wrappers; Windows has `verifyUpdateCodeSignature: false`.
- Packaging commands: Windows `pnpm run prep:win-binaries && pnpm run package:win`; mac `pnpm run package:mac` or local skip-skills path `SKIP_PREINSTALLED_SKILLS=1 pnpm run package && electron-builder --mac --publish never`; Linux `pnpm run package:linux`.
- Do not run `pnpm run release` unless intentionally publishing; `postversion` pushes commits and tags, and release CI validates the tag against `package.json` via `scripts/assert-tag-matches-package.mjs`.
- Comms regression: `pnpm run comms:replay` writes `artifacts/comms/current-metrics.json`; `pnpm run comms:compare` enforces baseline thresholds/scenarios; `pnpm run comms:baseline` updates the baseline.

## Environment values worth not rediscovering
- `.env.example` documents `OPENCLAW_GATEWAY_PORT=18789`, `VITE_DEV_SERVER_PORT=5173`, and release signing variables (`APPLE_*`, `CSC_*`, `GH_TOKEN`).
