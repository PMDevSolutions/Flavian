# Flavian Desktop GUI

A cross-platform desktop app that wraps Flavian's existing CLI workflows — the setup
wizard, the Docker WordPress lifecycle, the Figma/Canva/InDesign conversion pipelines,
and the visual-QA workflow — so a designer or less-technical WordPress user can go from
"design in" to "working theme out" without touching a terminal.

> **Status:** v3.0.0, in progress (epic #100). This first slice ships the **application
> shell + orchestration core** and one working screen (**Prerequisites**). The setup
> wizard, Docker controls, pipeline selection, conversion progress, and visual-QA review
> screens land in the following sub-issues.

The GUI is a **thin orchestration layer**: it invokes the repo's existing scripts and
pipelines (`scripts/init.mjs`, `wordpress-local.sh`, `flavian pipeline …`, the visual-QA
scripts) and Claude Code — it does **not** reimplement any pipeline logic.

## Stack

- **Electron + TypeScript + React**, built with [electron-vite](https://electron-vite.org/)
  and packaged (later) with electron-builder.
- Lives as a workspace package at `packages/gui/` (`@flavian/gui`).
- The Electron **main process is Node.js**, so it imports the repo's existing Node modules
  directly (e.g. `scripts/init/apply.mjs`) and shares one code path with the CLI.

## Architecture

A hard layering boundary keeps the orchestration logic testable without launching Electron:

| Layer | Path | Rule |
| --- | --- | --- |
| Shared | `src/shared/` | Types + IPC channel constants; imported by both sides. |
| Core | `src/core/` | **Pure Node/TS, no `electron` import.** Process spawning, the shell resolver, the task model, output parsing. 100% unit-tested. |
| Main | `src/main/` | Electron main; imports core, bridges core events ⇄ IPC, owns the window. |
| Preload | `src/preload/` | `contextBridge` only — exposes the typed `window.flavian` bridge. |
| Renderer | `src/renderer/` | React; talks only to `window.flavian`. |

The renderer can only invoke named, typed operations on the bridge — never an arbitrary
command. Each future feature adds one typed method + an `ipcMain` handler; the generic
task-streaming channel (`onTaskEvent` / `getTaskSnapshot` / `cancelTask`) works for all of
them.

### Process layer

`ProcessRunner` spawns a command (`child_process`, no `shell:true`), streams stdout/stderr
as structured events, reports the exit code, and is cancellable. A cross-platform
**shell resolver** finds a POSIX `bash` (Git Bash on Windows, excluding the WSL
`System32\bash.exe`) to run the repo's `.sh` scripts; `docker`/`node`/`pnpm`/`claude` are
invoked directly. A `PtyRunner` stub reserves the seam for node-pty (needed later for the
Figma `claude` session and `docker logs -f`).

## Commands

From the repo root:

```bash
pnpm gui:dev         # launch the app in development (Vite HMR)
pnpm gui:build       # build main/preload/renderer bundles
pnpm gui:test        # run the core unit tests (headless, no Electron window)
pnpm gui:typecheck   # type-check main + renderer
```

Or from `packages/gui/`: `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm typecheck`.

## Tests

The orchestration core is covered by `node --test` (via `tsx`) under
`packages/gui/tests/` — process runner, shell resolver, prerequisite parser,
prerequisite orchestration, and project-root detection. These run headless in CI
(`.github/workflows/gui.yml`, Node 22) and never open a window.

## Requirements

Running the packaged GUI still requires the same tools Flavian itself needs — Claude Code,
Docker, Git, Node — which is exactly what the **Prerequisites** screen detects (by running
`scripts/check-prerequisites.sh` and rendering the result with actionable guidance). On
Windows the GUI needs Git Bash available to run the repo's `.sh` scripts.
