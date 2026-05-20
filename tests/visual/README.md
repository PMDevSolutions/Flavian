# Visual Regression Suite

Catches unintended UI changes in `themes/flavian-shop/` by diffing PR
screenshots against committed baseline images. Runs in CI on every PR that
touches theme files; can also be run locally with Docker.

## TL;DR

```bash
# One-time setup (after cloning):
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm playwright:install

# Capture + diff against committed baselines:
bash scripts/visual-capture.sh   # boots Docker, seeds, captures into tests/visual/actual/
pnpm visual:diff                 # diffs actual/ vs baselines/

# Intentional UI change? Update baselines:
bash scripts/visual-update-baselines.sh
git add tests/visual/baselines
git commit -m "test(visual): update baselines"
```

## Directory layout

```
tests/visual/
├── README.md             ← you are here
├── urls.json             ← page slug → URL map + breakpoint widths
├── masks.json            ← CSS selectors masked at capture time (per URL)
├── thresholds.json       ← per-URL diff threshold overrides
├── capture.mjs           ← Playwright orchestrator
├── print-report.mjs      ← formats visual-diff.js JSON + emits GH check annotations
├── seed.sh               ← deterministic WP/WooCommerce content seeder
├── baselines/            ← committed PNGs — the source of truth
├── actual/               ← gitignored; populated by capture.mjs
└── diffs/                ← gitignored; populated by scripts/visual-diff.js
```

## How CI runs it

`.github/workflows/visual-regression.yml` triggers on PRs that touch
`themes/**`, `tests/visual/**`, or the visual scripts. It:

1. Boots the same `docker-compose.yml` stack used for local dev.
2. Installs WooCommerce (no sample data) via the `woocommerce-installer` profile.
3. Runs `tests/visual/seed.sh` to inject deterministic products, pages, and
   normalized post dates.
4. Captures screenshots at 4 breakpoints (375 / 768 / 1440 / 1920).
5. Diffs them against `tests/visual/baselines/` using `scripts/visual-diff.js`
   (pixelmatch, with region-level analysis).
6. Surfaces failures as native GitHub Check annotations (`::error file=…`)
   so they appear inline on the PR's Files Changed view.
7. Uploads `actual/`, `diffs/`, and `report.json` as a workflow artifact so
   you can inspect what the runner saw.

### Soft-fail period

The workflow currently runs with `continue-on-error: true`. Failures do not
block merge while baselines are stabilizing. **Flip to `false` on or after
2026-06-02** by editing `.github/workflows/visual-regression.yml`.

## How to update baselines after an intentional UI change

```bash
bash scripts/visual-update-baselines.sh
```

This captures inside the same Playwright Docker image used by CI
(`mcr.microsoft.com/playwright:v1.60.0-jammy`) so the resulting PNGs match
what CI will produce — avoiding the subpixel font rendering drift you'd
otherwise see between local macOS/Windows and the Linux runner.

After running, `git diff --stat tests/visual/baselines/` shows what changed.
Commit the new PNGs alongside the code change that caused them. Reviewers
can scroll through the baseline diffs in the PR's Files Changed tab.

To update a single page only: `bash scripts/visual-update-baselines.sh --only shop`

### Bootstrap (first run)

`tests/visual/baselines/` is empty in the initial PR. To populate it:

- **Option A (recommended):** trigger the `visual-regression` workflow
  manually via the Actions tab with `bootstrap: true`. It will capture and
  commit baselines back to the current branch as a `[skip ci]` commit.
- **Option B:** run `scripts/visual-update-baselines.sh` locally and push.

## Configuration

### `urls.json`

Each entry is `{ slug, template, path }`. `slug` is the filename prefix
(`<slug>-<breakpoint>-<width>px.png`); `template` is informational; `path` is
the URL appended to `baseUrl`.

### `masks.json`

Selectors listed under `"*"` are masked on every page. Path-specific keys
add to that list. Add a selector here if a diff failure is caused by
deterministic-but-time-sensitive content (e.g. WooCommerce price totals
that depend on cart fixtures) rather than a real UI change.

Masks paint a magenta rectangle over the matched elements before
screenshotting — the rectangles themselves are identical in actual and
baseline, so they diff to zero.

### `thresholds.json`

Defaults to **0.5% full-page mismatch**, with looser per-path overrides for
cart/checkout/my-account (where WooCommerce styles are still settling).
Tighten once baselines have been stable for ~2 weeks.

## Debugging a failure

1. Open the failing PR run, scroll to the `visual-regression` job.
2. Download the `visual-regression-<run-id>` artifact from the run summary.
3. Open `report.json` — the `regions.failing` array per file tells you which
   quadrant changed.
4. Compare `actual/<file>.png` vs `baselines/<file>.png` side by side; open
   `diffs/diff-<file>.png` to see the magenta-highlighted pixels.

If the change is intentional: run `visual-update-baselines.sh` (locally or
via the bootstrap workflow trigger) and commit the new PNGs.

If the change is unintentional: fix the underlying CSS/template change.

## Adding a new page to the suite

1. Add an entry to `tests/visual/urls.json`.
2. Add any URL-specific mask selectors to `tests/visual/masks.json` if the
   page renders dynamic content.
3. Run `scripts/visual-update-baselines.sh --only <slug>` to capture only
   the new page's baselines.
4. Commit the new PNGs.

## Related

- `scripts/visual-diff.js` — pixelmatch-based diff engine (pre-existing).
- `scripts/check-responsive.sh`, `scripts/check-dark-mode.sh` — ad-hoc
  Playwright capture for manual checks (unchanged).
- `.claude/agents/visual-qa-agent.md` — Figma-vs-rendered design QA
  (different problem; complements this suite rather than replacing it).
