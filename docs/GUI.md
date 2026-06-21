# Flavian Desktop GUI

A cross-platform desktop app that wraps Flavian's existing CLI workflows — the setup
wizard, the Docker WordPress lifecycle, the Figma/Canva/InDesign conversion pipelines,
and the visual-QA workflow — so a designer or less-technical WordPress user can go from
"design in" to "working theme out" without touching a terminal.

> **Status:** v3.0.0 (epic #100) — feature-complete across the six sub-issues. The app
> ships the **orchestration core** plus five screens: **Prerequisites**, **Setup wizard**,
> **WordPress (Docker)**, **Convert design**, and **Visual QA**, with packaging config in
> place. Launching the desktop window has been validated via the build; a future
> "Open project folder…" action and node-pty-backed interactive sessions are the main
> follow-ups.

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

## Screens

| Screen | What it does | Wraps |
| --- | --- | --- |
| **Prerequisites** | Runs the prereq check and shows a pass/fail checklist with actionable guidance. | `scripts/check-prerequisites.sh` |
| **Setup wizard** | Scaffolds a project (slug, theme starter, Canva/Woo/multisite/port…). | `scripts/init/` `resolveDefaults()` + `apply()` (in-process) |
| **WordPress (Docker)** | Build/start/stop/restart/install, live container status, theme activation, log streaming. | `wordpress-local.sh` + `docker compose` |
| **Convert design** | Launches a Figma, Canva, or InDesign conversion and streams progress. | `claude -p` / init canva path / `flavian pipeline indesign` |
| **Visual QA** | Runs visual-diff + Lighthouse and renders the artifacts (diff triptychs, scores, report). | `pnpm visual:diff` / `pnpm lighthouse:run` |

## Commands

From the repo root:

```bash
pnpm gui:dev         # launch the app in development (Vite HMR)
pnpm gui:build       # build main/preload/renderer bundles
pnpm gui:test        # run the core unit tests (headless, no Electron window)
pnpm gui:lint        # ESLint (flat config: TypeScript + React)
pnpm gui:typecheck   # type-check main + renderer
pnpm gui:package     # build + produce an installer via electron-builder
```

Or from `packages/gui/`: `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm typecheck`.

## Tests

The orchestration core is covered by `node --test` (via `tsx`) under
`packages/gui/tests/` — process runner, shell resolver, prerequisite parser,
prerequisite orchestration, and project-root detection. CI
(`.github/workflows/gui.yml`, Node 22) runs **lint → typecheck → tests**, all
headless — no window is launched. Linting is ESLint 9 flat config
(`eslint.config.mjs`): typescript-eslint for all `.ts`/`.tsx`/`.mts`, plus
React + React-Hooks rules for the renderer. Type-checking stays in `tsc`.

## Packaging & distribution

```bash
pnpm gui:package   # electron-vite build && electron-builder
```

Config: `packages/gui/electron-builder.yml` (targets: NSIS on Windows, DMG on macOS,
AppImage on Linux; output to `packages/gui/dist/`). Windows produces
`dist/Flavian Setup <version>.exe` (installer) plus a runnable `dist/win-unpacked/`.

Builds are **unsigned** (`signAndEditExecutable: false`) so `gui:package` works on a stock
Windows without elevated privileges. electron-builder's code-signing toolchain
(`winCodeSign`) ships macOS symlinks that Windows can't extract without Developer Mode or
an elevated shell, so it 404s the build — disabling signing sidesteps it entirely. For a
**signed release**, supply a certificate (`CSC_LINK` / `CSC_KEY_PASSWORD`), remove
`signAndEditExecutable: false`, and build on a host with signing privileges (Developer Mode
/ elevated shell, or CI).

The GUI **operates on a Flavian project directory on disk** — it writes themes, `.env`,
and conversion output there, so those files must stay writable. The app bundle therefore
ships only the GUI itself and does **not** embed the template or its scripts. At startup it
locates the project by walking up from where it runs (so launching from inside a checkout
"just works"); pointing it at an arbitrary folder is the planned **Open project folder…**
follow-up (the `resolveProjectRef`/`locateRepoRoot` seam already supports it).

The distribution model: a user installs the app and runs it against a Flavian project on
disk, driving setup → Docker → conversion → QA entirely through the UI — no terminal.

## Requirements

Running the GUI requires the same tools Flavian itself needs — Claude Code, Docker, Git,
Node — which is exactly what the **Prerequisites** screen detects (by running
`scripts/check-prerequisites.sh` and rendering the result with actionable guidance). On
Windows the GUI needs Git Bash available to run the repo's `.sh` scripts.
