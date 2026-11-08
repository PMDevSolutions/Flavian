# Trajan Engine Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the Aurelius and Vespasian GUI forks back into Flavian's `packages/gui` so one engine renders all three manifests, then give that engine a home the products depend on.

**Architecture:** The engine (core, main, preload, renderer shell) reads a `ProductManifest`; manifests are pure data; bespoke panels read the manifest. Fork features arrive as engine capabilities keyed by manifest data (a `site` screen, a generic `runStep`, manifest-declared inputs and QA artifacts), never as product branches.

**Tech Stack:** TypeScript, Electron 42, electron-vite 5, React 18, `node:test` via `tsx`, ESLint 9 flat config, electron-builder 26.

**Spec:** `docs/plans/2026-11-08-trajan-engine-reconciliation-design.md`

## Global Constraints

- `ACTIVE_PRODUCT_ID` stays `'flavian'` and `tests/shared/product/manifest.test.mts` stays green in every task.
- Manifests contain no functions and no Node imports; `tests/shared/product/registry.test.mts` round-trips every registered manifest through JSON.
- No engine or panel code branches on a product id; a product-specific behaviour is expressed as manifest data the engine interprets.
- Every task passes `pnpm --filter @flavian/gui lint`, `typecheck` and `test`; tasks that touch the renderer or main also pass `pnpm --filter @flavian/gui build` and `smoke`.
- Ported fork code arrives with its fork tests, adapted to Flavian's single-quote style.
- Conventional Commits, one commit per task: `feat(gui): …`, `test(gui): …`, `refactor(gui): …`.

## Review Focus

1. A registered manifest declares a screen the renderer has no panel for: the nav shows the entry and the content area stays blank. Pinned by Task 2's panel-map test.
2. A step names a parser the engine does not register: the task runs and then throws when its output is parsed. Pinned by the registry test (Task 1).
3. `fillTemplate` dropping an empty sole placeholder removes a required value and leaves its flag dangling (`--slug` with nothing after it). Pinned by Task 3a's tests on both the Aurelius `{dryRun}` case and Flavian's InDesign template.
4. `runStep` is asked to run a `module` or `delegate` step: `buildCommandSpec` throws a generic error after the IPC round trip. Pinned by Task 3b's handler test.
5. Vespasian's `use` and `apply` steps both take one positional argument but different placeholders (`{siteId}`, `{plan}`): a handler that fills only one leaves the other blank. Pinned by Task 2's handler test.

---

### Task 1: One contract, three manifests, one registry (done in PR for #187, slice 1)

**Files:**
- Modify: `packages/gui/src/shared/product/manifest.ts`
- Modify: `packages/gui/src/shared/product/index.ts`
- Modify: `packages/gui/src/shared/product/aurelius.ts` (scaffold becomes the real manifest)
- Create: `packages/gui/src/shared/product/vespasian.ts`
- Create: `packages/gui/src/shared/types/site.ts`
- Modify: `packages/gui/src/shared/types/task.ts`
- Test: `packages/gui/tests/shared/product/registry.test.mts`
- Modify: `packages/gui/docs/GUI-PLATFORM.md`

**Interfaces:**
- Produces: `ProductId = 'flavian' | 'aurelius' | 'vespasian' | 'nerva' | 'claudius' | (string & {})`; `ScreenId` with `'site'`; `ParserKey = 'prereq' | 'composePs'`; `ScreenExtras.frameworks?: readonly { id: string; label: string }[]`; `SiteCommand = 'list' | 'use' | 'apply' | 'publish'`; `WixSiteStatus`; `PRODUCTS` keyed `flavian | aurelius | vespasian`.

- [x] **Step 1: Write the failing registry tests** (`registry.test.mts`: registry keys, Aurelius and Vespasian screen lists, wizard command kinds, and per-manifest invariants: unique ids, labels, prereq convention, registered parsers, delegate targets, exit codes, JSON round trip).
- [x] **Step 2: Run them to verify they fail** (`node --import tsx --test tests/shared/product/registry.test.mts`: `Cannot find module …/vespasian`).
- [x] **Step 3: Widen the contract** in `manifest.ts`, port `types/site.ts`, rewrite `TaskKind`, port both manifests, register them in `index.ts`.
- [x] **Step 4: Run the suite, lint and typecheck** (`pnpm --filter @flavian/gui test`, `lint`, `typecheck`: all green).
- [x] **Step 5: Update `GUI-PLATFORM.md`** (stage status, the real manifests, the map) and commit.

### Task 2: Port the Wix-site screen

**Files:**
- Create: `packages/gui/src/core/wix/site-status.ts`, `packages/gui/src/core/project/list-plans.ts` (from Vespasian, verbatim)
- Modify: `packages/gui/src/shared/ipc-channels.ts`, `packages/gui/src/shared/types/ipc.ts`, `packages/gui/src/preload/index.ts`, `packages/gui/src/renderer/api/bridge.ts`, `packages/gui/src/main/ipc/register-handlers.ts`
- Create: `packages/gui/src/renderer/components/SitePanel.tsx` (from Vespasian), `packages/gui/src/renderer/screen-panels.tsx`
- Modify: `packages/gui/src/renderer/App.tsx`
- Test: `packages/gui/tests/core/wix/site-status.test.mts`, `packages/gui/tests/core/project/list-plans.test.mts` (from Vespasian), `packages/gui/tests/renderer/screen-panels.test.mts`, `packages/gui/tests/main/site-handlers.test.mts`

**Interfaces:**
- Consumes: `SiteCommand`, `WixSiteStatus` (Task 1).
- Produces: `parseEnv(text: string): Record<string, string>`; `siteStatusFromEnv(env, hasEnvFile: boolean, editorSessionCaptured: boolean): WixSiteStatus`; `readSiteStatus(repoRoot: string): Promise<WixSiteStatus>`; `listPlanDirs(repoRoot: string): Promise<string[]>`; IPC `siteRun`, `siteStatus`, `listPlans`; bridge `runSite(command: SiteCommand, arg?: string): Promise<{ taskId: string }>`, `getSiteStatus(): Promise<WixSiteStatus>`, `listPlans(): Promise<string[]>`; `SCREEN_PANELS: Readonly<Record<string, () => JSX.Element>>` with keys `prereq, wizard, docker, site, pipeline, qa`; `siteVars(command: SiteCommand, arg: string | undefined): Record<string, string>` exported from `register-handlers.ts`.

- [ ] **Step 1: Port the two core tests** from Vespasian unchanged; run them: FAIL, modules missing.
- [ ] **Step 2: Port `site-status.ts` and `list-plans.ts`** verbatim; run the tests: PASS.
- [ ] **Step 3: Write `tests/main/site-handlers.test.mts`** for `siteVars`: `siteVars('use', 'abc')` deep-equals `{ siteId: 'abc' }`, `siteVars('apply', 'landing')` deep-equals `{ plan: 'landing' }`, `siteVars('list', undefined)` deep-equals `{}`. Run: FAIL, no export.
- [ ] **Step 4: Add the IPC** (`siteRun: 'flavian:site:run'`, `siteStatus: 'flavian:site:status'`, `listPlans: 'flavian:project:plans'`), the three bridge methods in `types/ipc.ts`, preload and `bridge.ts`, and the three handlers in `register-handlers.ts` modelled on `dockerRun`, `dockerStatus` and `listThemes`, with `siteVars` doing the placeholder mapping. Run Step 3's test: PASS.
- [ ] **Step 5: Write `tests/renderer/screen-panels.test.mts`**: for every manifest in `PRODUCTS`, every `screen.id` is a key of `SCREEN_PANELS`. Run: FAIL, module missing.
- [ ] **Step 6: Create `screen-panels.tsx`** exporting `SCREEN_PANELS`, port `SitePanel.tsx`, and make `App.tsx` render `SCREEN_PANELS[view]` instead of the five `view === …` lines. If a panel reads `window` at import time, move that read inside the component. Run Step 5's test: PASS.
- [ ] **Step 7: Full gates** (`lint`, `typecheck`, `test`, `build`, `smoke`), then commit `feat(gui): port the Wix-site screen from Vespasian (#187)`.

### Task 3a: `fillTemplate` drops empty sole placeholders

**Files:**
- Modify: `packages/gui/src/core/product/command-spec.ts`
- Test: `packages/gui/tests/core/product/command-spec.test.mts`

**Interfaces:**
- Produces: `fillTemplate(template: readonly string[] | undefined, vars: CommandVars): string[]` (same signature, new rule).

- [ ] **Step 1: Add the failing tests**: `fillTemplate(['{name}', '--renderer', '{renderer}', '{dryRun}'], { name: 'app', renderer: 'vite', dryRun: '' })` deep-equals `['app', '--renderer', 'vite']`; `fillTemplate(['themes/{slug}'], {})` deep-equals `['themes/']`; `fillTemplate(['pipeline', 'indesign', '{file}', '--slug', '{slug}'], { file: 'a.idml', slug: '' })` deep-equals `['pipeline', 'indesign', 'a.idml', '--slug']` (named "an empty required value leaves its flag dangling; panels must validate before running"). Run: the first FAILS with `['app', '--renderer', 'vite', '']`.
- [ ] **Step 2: Implement Aurelius's rule**: a part that is exactly one placeholder with an empty value is dropped; embedded placeholders are still replaced with `''`. Run: PASS.
- [ ] **Step 3: Commit** `fix(gui): drop empty sole placeholders from command templates (#187)`.

### Task 3b: Generic step runner

**Files:**
- Modify: `packages/gui/src/shared/ipc-channels.ts`, `packages/gui/src/shared/types/ipc.ts`, `packages/gui/src/preload/index.ts`, `packages/gui/src/renderer/api/bridge.ts`, `packages/gui/src/main/ipc/register-handlers.ts`
- Create: `packages/gui/src/renderer/hooks/useStep.ts` (from Aurelius)
- Test: `packages/gui/tests/main/step-run.test.mts`

**Interfaces:**
- Produces: IPC `stepRun: 'flavian:step:run'`; bridge `runStep(screenId: ScreenId, stepId: string, vars?: Record<string, string>): Promise<{ taskId: string }>`; `resolveRunnableStep(manifest: ProductManifest, screenId: ScreenId, stepId: string): ProductStep` exported from `register-handlers.ts`, throwing `Error("Step \"<screen>/<step>\" is a '<exec>' command and runs through its own flow, not runStep.")` for `module` and `delegate`; `useStep(): StepController` with `{ active, lines, state, busy, error, run(screenId, stepId, label, vars?) }`.

- [ ] **Step 1: Write `step-run.test.mts`**: `resolveRunnableStep(flavianManifest, 'qa', 'visual:diff')` returns the step; `resolveRunnableStep(flavianManifest, 'wizard', 'apply')` throws `/runs through its own flow/`; `resolveRunnableStep(flavianManifest, 'pipeline', 'canva')` throws the same. Run: FAIL, no export.
- [ ] **Step 2: Implement `resolveRunnableStep`** and the `stepRun` handler (resolve, `buildCommandSpec(commands, root(), step.command, vars)`, start the task the way the `qaRun` handler does, honouring `step.successExitCodes`). Add the bridge method end to end and port `useStep.ts`. Run: PASS; `typecheck` green.
- [ ] **Step 3: Switch `QaPanel.tsx` to `runStep`** for its two buttons and delete `qaRun` (channel, bridge method, handler). `smoke` and `build` green.
- [ ] **Step 4: Commit** `feat(gui): run any manifest step through one IPC (#187)`.

### Task 3c: Extra prerequisite steps

**Files:**
- Modify: `packages/gui/src/renderer/components/PrereqPanel.tsx`

**Interfaces:**
- Consumes: `useStep` (Task 3b); `getScreen(activeManifest, 'prereq').steps.slice(1)`.

- [ ] **Step 1: Render one button per step after the first** under the report, labelled by `step.cta ?? step.label`, running `useStep().run('prereq', step.id, step.label)`, with the shared `LogStream` for its output. Flavian has no such step, so the panel is unchanged for this build; the Aurelius manifest's `playwright` step is the case it serves.
- [ ] **Step 2: Gates and commit** `feat(gui): render extra prerequisite steps from the manifest (#187)`.

### Task 3d: Script-backed wizard with framework choices

**Files:**
- Modify: `packages/gui/src/shared/product/manifest.ts` (`ScreenExtras.themeStarters` value becomes `string`; `ThemeStarter` typing moves to `flavian.ts` with `satisfies`)
- Modify: `packages/gui/src/renderer/components/WizardPanel.tsx`
- Test: `packages/gui/tests/shared/product/registry.test.mts` (one added case)

**Interfaces:**
- Consumes: `soleStep(activeManifest, 'wizard').command.exec` to pick the path; `runStep` (Task 3b) with vars `{ name, renderer, dryRun }` where `dryRun` is `'--dry-run'` or `''`.

- [ ] **Step 1: Add the registry assertion**: for every manifest, the wizard step is either `module` with `extras.themeStarters` or `bashScript` with `extras.frameworks`. Run: PASS already for all three (this pins the two shapes the panel must handle).
- [ ] **Step 2: Split `WizardPanel.tsx`** into the existing module form (unchanged behaviour) and a script form ported from Aurelius: project name, a framework select from `extras.frameworks`, a dry-run checkbox, `runStep`. The choice is `command.exec`, read once from the manifest.
- [ ] **Step 3: Gates (`smoke` must still reach the Flavian wizard) and commit** `feat(gui): script-backed setup wizard driven by the manifest (#187)`.

### Task 3e: Manifest-declared pipeline inputs

**Files:**
- Modify: `packages/gui/src/shared/product/manifest.ts`, `packages/gui/src/shared/product/flavian.ts`, `aurelius.ts`, `vespasian.ts`
- Modify: `packages/gui/src/renderer/components/PipelinePanel.tsx`
- Test: `packages/gui/tests/shared/product/registry.test.mts`

**Interfaces:**
- Produces: `StepInput = { readonly name: string; readonly label: string; readonly kind: 'text' | 'url' | 'file' | 'directory'; readonly required?: boolean }`; `ProductStep.inputs?: readonly StepInput[]`. Every `{placeholder}` in a step's `argsTemplate` must be declared in `inputs`, except placeholders the panel fills itself (`slug`), listed in `ProductStep.derivedVars?: readonly string[]`.

- [ ] **Step 1: Add the registry test**: for every step with `argsTemplate`, every `{name}` is in `inputs` or `derivedVars`. Run: FAIL for Flavian's Figma, InDesign and Vespasian's steps.
- [ ] **Step 2: Declare inputs in the three manifests** (Flavian: `figmaUrl` url, `file` file for InDesign, `slug` derived; Aurelius: `figmaUrl`; Vespasian: `figmaUrl`, `canvaExport` directory, `file`, `slug` derived; the `site` screen's `siteId` and `plan` come from the panel's own pickers and are `derivedVars`). Run: PASS.
- [ ] **Step 3: Render the pipeline form from `inputs`** (text/url fields, file and directory pickers through the existing dialog bridge methods) and show `step.cta ?? 'Run'` and `extras.links`. Flavian's three forms must look and behave as before.
- [ ] **Step 4: Gates and commit** `feat(gui): pipeline inputs declared in the manifest (#187)`.

### Task 3f: One QA artifact model

**Files:**
- Modify: `packages/gui/src/shared/types/qa.ts`, `packages/gui/src/shared/product/manifest.ts` (`ScreenExtras.qaReports`, `ScreenExtras.qaGalleries`), `packages/gui/src/core/qa/discover.ts`, `packages/gui/src/renderer/components/QaPanel.tsx`, `aurelius.ts`
- Test: `packages/gui/tests/core/qa/qa.test.mts`

**Interfaces:**
- Produces: `QaReport = { title: string; relPath: string }`, `QaGallery = { title: string; relDir: string; images: string[] }`; `QaArtifacts` gains `reports: QaReport[]` and `galleries: QaGallery[]` next to the existing `visual`, `lighthouse` and `design` fields; `discoverQaArtifacts(repoRoot: string, extras: ScreenExtras | undefined): Promise<QaArtifacts>`.

- [ ] **Step 1: Add tests**: with Aurelius's eight gallery and two report declarations and a fixture tree holding two PNGs and one report, discovery returns one populated gallery and one report and empty Flavian fields; with no declarations it returns the Flavian fields as today.
- [ ] **Step 2: Move Aurelius's `QA_REPORTS` and `QA_GALLERIES` into the Aurelius manifest's `qa.extras`**, extend `discover.ts`, render the new sections in `QaPanel.tsx` only when non-empty.
- [ ] **Step 3: Gates and commit** `feat(gui): QA artifacts declared per product (#187)`.

### Task 4: Product-neutral transport and build identity

**Files:**
- Modify: `packages/gui/src/shared/ipc-channels.ts`, `packages/gui/src/shared/types/ipc.ts`, `packages/gui/src/preload/index.ts`, `packages/gui/src/renderer/api/bridge.ts`, `packages/gui/src/renderer/vite-env.d.ts`
- Modify: `packages/gui/electron-builder.yml`, `packages/gui/package.json`, `packages/gui/tests/smoke/smoke.mjs`, `packages/gui/tests/packaging/electron-builder-config.test.mts`

**Interfaces:**
- Produces: channel prefix `gui:` (from `flavian:`); bridge global `window.gui` typed `GuiBridge` (from `window.flavian`, `FlavianBridge`); `GUI_PRODUCT` environment variable read by `electron-builder.yml` (`productName`, `appId`, `linux.executableName`) with Flavian's values as the defaults; the smoke test asserts the brand equals `activeManifest.displayName`.

- [ ] **Step 1: Extend the packaging test**: with `GUI_PRODUCT` unset the config names Flavian; the test documents the three fields that vary.
- [ ] **Step 2: Rename channels and the bridge** in one commit (`refactor(gui): product-neutral IPC and bridge names (#187)`); `typecheck` catches every caller.
- [ ] **Step 3: Parameterise build identity** and the smoke brand assertion; `build`, `smoke`, the packaging test and `gui-release.yml`'s artifact names stay green for Flavian.

### Task 5: The engine's home and fork adoption (blocked on the owner's decision in the design)

- [ ] **Option A, new repository `PMDevSolutions/Trajan`:** move `packages/gui` with history (`git filter-repo --subdirectory-filter packages/gui`), carry `gui.yml`, `gui-release.yml` and the release chain from #189; publish `@pmds/trajan-engine` (the engine) and build Trajan from it; Flavian, Aurelius and Vespasian keep only their manifests (or contribute them to Trajan's `src/shared/product/`).
- [ ] **Option B, package from `packages/gui`:** add `exports` for `src/shared/product/manifest.ts`, core and the renderer shell; publish on Flavian's release; Aurelius and Vespasian add the package and a `packages/gui` that holds only their manifest and panels.
- [ ] Either way, done when both forks' CI runs the shared engine's `lint`, `typecheck`, `test` and `smoke` against their manifest.

### Task 6: Fork retirement

- [ ] Aurelius#149: delete `packages/gui`, keep its manifest where Task 5 put it, confirm installers still attach on release.
- [ ] Vespasian#40: delete `packages/gui`, confirm the Wix-site screen renders from the shared engine, close the Electron 39 to 42 upgrade as superseded.
- [ ] Update `GUI-PLATFORM.md` stage 4 to done and link the Trajan repository or package.
