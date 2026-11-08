# GUI platform — from "the Flavian app" to a shared engine (Trajan)

`@flavian/gui` started as a desktop shell hard-wired to drive **Flavian**. We are
evolving it into a generic engine that renders **any PMDS framework** (Flavian,
Aurelius, Vespasian, Nerva, Claudius) from a typed descriptor. The unified app that ships all of them is
**Trajan**.

This doc is a pointer for that work, not a spec. It describes the three-layer
architecture the codebase now follows and the staged plan it serves.

## Three layers

1. **Shared engine** — generic machinery that knows nothing about any product:
   the task model (`src/core/task`), process running (`src/core/process`,
   `src/core/shell`), the IPC handlers (`src/main/ipc`), the React shell + reusable
   components/hooks (`src/renderer`), and the manifest interpreters
   (`src/core/product/command-spec.ts`, `src/core/product/parsers.ts`). A new product
   does not change this layer.

2. **Per-product manifest** — one pure-data `ProductManifest`
   (`src/shared/product/manifest.ts`) that declares **what a product exposes**:
   identity, project-detection markers, and the screens → steps → (command, parser,
   prerequisites) catalog. The Flavian manifest is `src/shared/product/flavian.ts`.
   It speaks the engine's existing vocabulary — `TaskKind`, `DockerCommand`,
   `QaScript`, `PipelineKind`, `ThemeStarter` — rather than inventing new terms, and
   is node-free + serializable so the sandboxed renderer, main, and preload can all
   import it. The active product is chosen in `src/shared/product/index.ts`
   (`activeManifest`); main injects it into `registerHandlers`, and the renderer shell
   reads its brand + nav from it.

3. **Per-product specifics** — the bespoke React panels
   (`src/renderer/components/*Panel.tsx`). Each is a custom UI for one screen; it now
   reads its *step catalog* (which commands/kinds/themes exist, their labels) from the
   manifest, while keeping its product-specific layout. As the platform matures, more
   of each panel's surface migrates up into the manifest.

The dependency rule: layer 1 reads layer 2; layer 2 is data; layer 3 reads layer 2.
Nothing in layers 1/3 hard-codes a product's scripts, screens, or identity.

## Adding a product (the extension point)

A second product is *only another manifest* — no engine/core/renderer change:

1. author `src/shared/product/<product>.ts` (another `ProductManifest`);
2. register it in `src/shared/product/index.ts` → `PRODUCTS`;
3. point `ACTIVE_PRODUCT_ID` at it (or, under Trajan, select per-product at runtime).

The Aurelius and Vespasian manifests (`src/shared/product/aurelius.ts`, `vespasian.ts`) are
registered this way: they are the forks' catalogs as of 2026-11-08 and type-check against the
same contract (`tests/shared/product/registry.test.mts` pins the invariants every registered
manifest keeps). Their fork-only screens (Wix site, Build from Figma) render here once the
reconciliation plan ports the panels; until then this build keeps `ACTIVE_PRODUCT_ID = 'flavian'`.
Design and plan: `docs/plans/2026-11-08-trajan-engine-reconciliation-design.md` and
`…-plan.md` (#187).

## Staged plan

1. **Ship Flavian** — the hard-wired desktop app. ✅ (through v1.10.0)
2. **Manifest seam** — extract Flavian's implicit catalog into an explicit
   `ProductManifest`; make the engine render from it with zero behaviour change. ✅
3. **Prove reuse with Aurelius** — author a second manifest and drive it through the
   same engine; fix whatever leaks a Flavian assumption. ✅ Done by forking the engine into
   Aurelius (2026-09-12) and Vespasian instead; on 2026-11-08 their manifests came back into
   this engine's contract (#187).
4. **Extract the engine** — split the generic layer out so products can be packaged
   independently of any one of them. ◀ **this step**: reconcile the forks into this engine,
   then give it its own home (#187; design and plan under `docs/plans/`).
5. **Add Nerva and Claudius** — two more manifests (Nerva#140, Claudius#169), validating the
   engine across five products.
6. **Ship Trajan** — one app that selects a product at runtime and renders any of them
   (#188 runtime selection and new-project-from-template; #189 the release chain).

## Scope notes (intentionally deferred)

These remain product-specific for now and are tracked for later stages — they were out
of scope for the zero-behaviour-change manifest seam:

- **Panel presentation prose** — explanatory copy in the panels (e.g. "runs
  `wordpress-local.sh`") still lives in the components. The *operational* catalog
  (scripts, commands, parsers, markers, links, chooser copy) is in the manifest; the
  remaining prose is presentation and will follow.
- **Bridge / IPC namespace** — the renderer↔main bridge is still `window.flavian` and
  the IPC channels are still `flavian:*`. That is shared transport vocabulary, not
  product catalog; Trajan keeps a single bridge, so renaming is deferred.
- **Build identity** — the package name (`@flavian/gui`), window title, and installer
  name still say "Flavian". These identify *this build*, analogous to
  `ACTIVE_PRODUCT_ID`, and change when Trajan packaging lands.

## Map

| Concern | File |
| --- | --- |
| Manifest type | `src/shared/product/manifest.ts` |
| Flavian manifest | `src/shared/product/flavian.ts` |
| Registry + active product + selectors | `src/shared/product/index.ts` |
| Aurelius manifest (fork catalog, 2026-11-08) | `src/shared/product/aurelius.ts` |
| Vespasian manifest (fork catalog, 2026-11-08) | `src/shared/product/vespasian.ts` |
| Wix-site vocabulary (`SiteCommand`, `WixSiteStatus`) | `src/shared/types/site.ts` |
| Registry invariants | `tests/shared/product/registry.test.mts` |
| Reconciliation design and plan | `docs/plans/2026-11-08-trajan-engine-reconciliation-*.md` |
| Command interpreter | `src/core/product/command-spec.ts` |
| Output-parser registry | `src/core/product/parsers.ts` |
| Manifest injection point | `src/main/index.ts`, `src/main/ipc/register-handlers.ts` |
| Shell reads brand + nav | `src/renderer/App.tsx` |
