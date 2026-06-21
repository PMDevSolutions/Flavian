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
| **WordPress (Docker)** | Build/start/stop/restart/install, live container status, theme activation, log streaming; quick links to the site / wp-admin / phpMyAdmin, first-run ordering guidance, and actionable error hints (Docker not running, port conflicts) linking to `docs/docker-troubleshooting.md`. | `wordpress-local.sh` + `docker compose` |
| **Convert design** | Pick Figma / Canva / InDesign, provide the input (Figma URL with validation + Dev Mode/Professional-plan note; native folder picker for Canva; native `.idml`/PDF file picker for InDesign), launch the existing workflow, and stream progress with running/success/failure states. On success, surfaces the theme location with a direct **Activate** action; on failure, links to the troubleshooting docs. Links to each pipeline's docs. | `claude -p` / init canva path / `flavian pipeline indesign` |
| **Visual QA** | Runs visual-diff + Lighthouse and renders the artifacts: regression diff triptychs, Lighthouse scores, the QA agent's report, and (where available) **design-vs-result** side-by-side from the visual-qa-agent screenshots. | `pnpm visual:diff` / `pnpm lighthouse:run` |

The **Setup wizard** mirrors `pnpm run init` — the same inputs and flags documented in
**[CLI-WIZARD.md](CLI-WIZARD.md)** — and runs the wizard's `apply()` / `resolveDefaults()`
in-process (one shared code path, no duplicated setup logic) rather than spawning the CLI.
It surfaces each step (`.env` written, theme scaffolded, git commit) as a streamed log with
success/error states, and validates inputs (via `resolveDefaults`) before running.

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

**Versioning & release artifacts.** The GUI version is written by release-please
(`packages/gui/package.json` is an `extra-files` entry in `release-please-config.json`), so
it tracks the repo's git-tag-driven version and is **never hand-bumped**. When release-please
publishes a GitHub Release, the **GUI Release Build** workflow
(`.github/workflows/gui-release.yml`) builds the macOS / Windows / Linux installers,
smoke-tests each, and attaches them to the release. A packaged-launch smoke test also runs on
every GUI PR (`.github/workflows/gui.yml`, via Xvfb).

The GUI **operates on a Flavian project directory on disk** — it writes themes, `.env`, and
conversion output there, so those files must stay writable. The app bundle therefore ships
only the GUI itself and does **not** embed the template or its scripts. At startup it locates
the project by walking up from where it runs (launching from inside a checkout "just works");
the **Open project folder…** action (sidebar "Choose project…" / "Change…") lets you point it
at any checkout, and the choice is remembered between launches.

The distribution model: a user installs the app and runs it against a Flavian project on
disk, driving setup → Docker → conversion → QA entirely through the UI — no terminal.

## First run & walkthrough

1. **Install & launch** — run the installer for your OS (or `pnpm gui:dev` from a checkout).
2. **Open a project** — on first launch, click **Choose folder…** and pick your Flavian
   checkout (the folder with `wordpress-local.sh`). It's remembered next time.
3. **Prerequisites** — confirm Claude Code, Docker, Git, and Node are detected; fix anything
   flagged.
4. **Setup wizard** — scaffold a project (slug, theme starter, options) — runs the same
   `apply()`/`resolveDefaults()` as `pnpm run init`.
5. **WordPress** — **Build → Start → Install**, then open the site / wp-admin from the quick
   links.
6. **Convert design** — pick Figma / Canva / InDesign, provide the input, launch, and watch
   the streamed progress; on success, click **Activate theme**.
7. **Visual QA** — run visual-diff + Lighthouse and review the diffs, scores, and any
   design-vs-result comparison.

## Requirements

Running the GUI requires the same tools Flavian itself needs — Claude Code, Docker, Git,
Node — which is exactly what the **Prerequisites** screen detects (by running
`scripts/check-prerequisites.sh` and rendering the result with actionable guidance). On
Windows the GUI needs Git Bash available to run the repo's `.sh` scripts.
