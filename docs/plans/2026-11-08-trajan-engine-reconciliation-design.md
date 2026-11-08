# Trajan engine reconciliation: design

**Issue:** [#187](https://github.com/PMDevSolutions/Flavian/issues/187), stage 4 of
`packages/gui/docs/GUI-PLATFORM.md`, part of the Trajan epic
[#186](https://github.com/PMDevSolutions/Flavian/issues/186).
**Date:** 2026-11-08. **Plan:** `2026-11-08-trajan-engine-reconciliation-plan.md`.
**Status:** slice 1 (the contract and the registry) is implemented; slices 2 to 6 are planned.

## Intent

One desktop engine renders every PMDS framework from a typed manifest. Today the engine exists
three times: here (`@flavian/gui`), in Aurelius (`@aurelius/gui`, forked from Vespasian on
2026-09-12) and in Vespasian (`@vespasian/gui`). Each copy fixed its own bugs and grew its own
screens, and the manifest contract itself split. Every week apart makes the merge dearer. The
reconciliation brings the two forks' catalogs and features back into this engine, then gives the
engine a home the products depend on instead of copying it.

## Measured drift (2026-11-08)

`diff -r` over the files all three copies share, Flavian `main` 92ea40f against Aurelius `main`
86bcc99 (2026-11-06) and Vespasian `main` ed0696c (2026-11-04); changed lines, both directions:

| Area | vs Aurelius | vs Vespasian |
| --- | ---: | ---: |
| `src/core` | 682 | 219 |
| `src/shared` | 529 | 186 |
| `src/main` | 240 | 31 |
| `src/renderer` | 931 | 314 |
| `tests` | 1094 | 542 |

Files only a fork has: Aurelius `renderer/hooks/useStep.ts` (drives any script-backed step
through a generic `runStep` IPC); Vespasian `shared/types/site.ts`, `core/wix/site-status.ts`,
`core/project/list-plans.ts`, `renderer/components/SitePanel.tsx`, `shared/product/vespasian.ts`
(the Wix-site screen). Files only Flavian has: the Docker screen (`shared/types/docker.ts`,
`core/docker/docker-status.ts`, `renderer/components/DockerPanel.tsx`), `core/init/run-init.ts`,
`core/project/list-themes.ts`, `core/process/collect.ts` and the packaging test.

Toolchains: Flavian 2.1.2 and Aurelius 2.1.0 on Electron 42, electron-vite 5, Vite 6, React 18;
Vespasian 0.2.1 on Electron 39, electron-vite 6, Vite 8, React 19.

Where the contract split:

- `ScreenId`: Flavian adds `docker`, Vespasian adds `site`, Aurelius has neither.
- `CommandDescriptor`: Aurelius dropped `module` and `delegate` (its wizard is a bash script).
- `ParserKey`: Flavian adds `composePs`.
- `ScreenExtras`: Flavian has `themeStarters`, Aurelius has `frameworks`.
- `ProductId` and `TaskKind` unions differ in every copy; Flavian's `TaskKind` still lists
  literals nothing emits (`docker-start`, `visual-qa`).
- IPC: Flavian has `dockerRun`, `dockerStatus`, `listThemes`, `qaRun`; Vespasian has `siteRun`,
  `siteStatus`, `listPlans`; Aurelius replaced `qaRun` with a generic `stepRun`.
- QA artifacts: Flavian discovers a visual report, a Lighthouse summary and a design comparison;
  Aurelius discovers Markdown reports and PNG galleries.
- Every copy names its product in the IPC channel prefix, the bridge (`window.flavian`) and the
  build identity.

## Goals

1. One `ProductManifest` contract; the Flavian, Aurelius and Vespasian manifests type-check
   against it and are registered in one engine. (slice 1)
2. The engine renders every screen of every registered manifest: Vespasian's Wix-site screen
   and Aurelius's Build-from-Figma flow move in. (slices 2 and 3)
3. Generic step execution: one `runStep` IPC any panel can drive, so product-specific IPC
   stops growing. (slice 3)
4. Product-neutral transport and build identity, so one build can carry any product. (slice 4;
   the prerequisite for runtime selection, #188)
5. The engine has one home products depend on, and the forks delete their copies. (slices 5
   and 6; Aurelius#149, Vespasian#40)

## Non-goals

- Runtime product selection and new-project-from-template: #188.
- The release chain that attaches installers: #189.
- The Nerva and Claudius manifests (Nerva#140, Claudius#169). They need only the contract from
  slice 1 and the generic step runner from slice 3, and are authored in their own issues.
- Upgrading Vespasian's Electron in place: Vespasian#40 replaces that with adopting the engine.

## Anti-goals

- A Flavian build whose behaviour changes before Trajan ships. Every slice keeps
  `ACTIVE_PRODUCT_ID = 'flavian'` and the Flavian manifest tests green.
- A fourth copy, even a temporary one. Fork code is ported into this engine file by file with
  its tests; nothing is copied wholesale and left to drift.
- Engine code that knows a product. Panels read the manifest, core interprets descriptors,
  nothing branches on a product id.
- Destabilising the recorded demo on 2026-11-17 (#191). Slices are additive and land behind the
  existing gates: GUI lint, typecheck, unit tests and the packaged smoke test.

## Constraints

- The layering rule from `GUI-PLATFORM.md`: the engine reads the manifest, the manifest is data,
  panels read the manifest.
- Manifests stay pure, serializable data (no functions, no Node imports). The registry test
  round-trips every manifest through JSON.
- Flavian's toolchain is the baseline: Node 22+, pnpm 9, Electron 42, electron-vite 5, React 18.
- Conventional Commits; release-please owns versions, including `packages/gui/package.json`.

## Decisions taken in slice 1

These are the implementer's calls; challenge them in the PR.

1. **Flavian's copy is the base**, as the issue proposes: newest, most screens, Electron 42.
2. **`ParserKey` stays a closed union** (`'prereq' | 'composePs'`) rather than `(string & {})`.
   The engine throws at run time on an unknown key, so an open type would only hide typos.
   Adding a parser is one key in `manifest.ts` and one entry in `core/product/parsers.ts`; the
   registry test checks that every parser a manifest names resolves.
3. **`TaskKind` names the vocabulary the manifests emit**: `prereq-check`, `prereq:*`, `init`,
   `docker:<DockerCommand>`, `site:<SiteCommand>`, `pipeline:<PipelineKind>`, `qa:*`. The stale
   literals nothing used are gone. `(string & {})` stays so a new product can add kinds.
4. **`ScreenExtras` is the union of the forks' extras**: `links`, `docs`, `themeStarters`,
   `frameworks`. `themeStarters` keeps Flavian's `ThemeStarter` type for now; the wizard contract
   is generalised in slice 3 together with the Aurelius script-wizard path.
5. **`ProductId` names all five products** (`flavian`, `aurelius`, `vespasian`, `nerva`,
   `claudius`); **`ScreenId` gains `site`**.
6. **The Aurelius and Vespasian manifests are ported verbatim** (quote style aside) from the fork
   commits above and registered in `PRODUCTS`, so the three catalogs are visible and tested in one
   place while the forks still ship. Until slices 2 and 3 land, selecting them would leave the
   `site` screen and Aurelius's second prerequisite step unrendered; `ACTIVE_PRODUCT_ID` stays
   `flavian`, and the registry test says so.
7. **`shared/types/site.ts` is ported now** (data types only) because the Vespasian manifest is
   typed against `SiteCommand`, the same way the Docker screen is typed against `types/docker.ts`.

## Decisions reserved for the product owner

From #186, with a recommendation each:

- **Where the engine lives.** Recommendation: keep it in `packages/gui` here through slices 1 to
  4, where the work is, then extract it to a `PMDevSolutions/Trajan` repository in slice 5, when
  the forks adopt it. One repository gives the release chain (#189) and the installers one home
  and stops every framework depending on Flavian's release cadence. Publishing the engine as a
  package from `packages/gui` is the fallback if a new repository is not wanted; the slice-5 plan
  covers both.
- **Branded builds or one app.** Recommendation: one distributed app (Trajan) with runtime
  selection (#188). Product-branded builds stay possible from the same engine through build-time
  identity (slice 4), but each one costs a release pipeline.
- **Code signing.** Out of scope for the reconciliation; unsigned builds warn on first launch on
  Windows and macOS.

## Slices

| Slice | Delivers | Done when |
| --- | --- | --- |
| 1 | One contract; three manifests registered; registry invariants tested | `gui:typecheck`, `gui:lint`, `gui:test` green with all three manifests in `PRODUCTS`; this build still ships Flavian |
| 2 | Vespasian's Wix-site screen in this engine | The Vespasian manifest's `site` screen renders here; the ported site-status and list-plans tests pass; every screen of every registered manifest maps to a panel |
| 3 | Aurelius's additions and the generic step runner | `runStep` IPC and `useStep`; extra prerequisite steps; the script wizard path with `frameworks`; manifest-declared pipeline inputs; a QA artifact model that covers both products; `fillTemplate` drops empty sole placeholders |
| 4 | Product-neutral transport and build identity | No product name in IPC channels, the bridge or the build config; the smoke test and the installer name come from the active manifest |
| 5 | The engine's home and fork adoption | Aurelius and Vespasian build from the shared engine, per the owner's decision above |
| 6 | Fork retirement | Aurelius#149 and Vespasian#40 closed; `packages/gui` deleted in both repositories |
