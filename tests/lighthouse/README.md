# Lighthouse CI / Performance Budgets

Enforces page-weight, Core Web Vitals, and Lighthouse-score budgets against
`themes/flavian-shop/` on every PR that touches theme code. Runs via
[`@lhci/cli`](https://github.com/GoogleChrome/lighthouse-ci) inside the
same Docker WP stack the visual regression suite uses.

## TL;DR

```bash
# One-time setup:
pnpm install
pnpm playwright:install   # only if you don't have Chrome locally

# Run the full suite locally (boots Docker, seeds, runs lhci):
pnpm lighthouse:run

# Inspect the HTML reports:
pnpm lighthouse:open
```

## Files

```
lighthouserc.json                    ← lhci config: URLs, asserts, upload target
tests/lighthouse/
├── README.md                        ← you are here
├── budgets.json                     ← resource budgets (KB) + timing budgets (ms)
└── annotate-report.mjs              ← parses lhci output, emits GH check annotations
.github/workflows/lighthouse-ci.yml  ← CI orchestration
```

## What runs in CI

`.github/workflows/lighthouse-ci.yml` triggers on PRs touching `themes/**`,
`tests/lighthouse/**`, or `lighthouserc.json`. It:

1. Boots `docker compose up -d wordpress db`.
2. Installs WooCommerce via the `woocommerce-installer` profile (no sample data).
3. Runs `tests/visual/seed.sh` for deterministic content (shared with visual regression).
4. Invokes `treosh/lighthouse-ci-action@v12` with our config.
5. Uploads the Lighthouse HTML reports as a workflow artifact.
6. Uploads to LHCI's **temporary-public-storage** — a sharable URL appears in
   the workflow log, viewable for ~7 days.
7. Runs `annotate-report.mjs` to surface each violation as a native GitHub
   Check annotation (`::error title=...::`).

### URLs covered

| URL                             | Why                                                |
| ------------------------------- | -------------------------------------------------- |
| `/`                             | Homepage — always hit                              |
| `/shop/`                        | Heaviest template (product grid, images, JS)       |
| `/product/test-hoodie/`         | Single-product render — WC adds significant assets |
| `/cart/`                        | Catches cart-block JS regressions                  |

Each URL is run `numberOfRuns: 3` times; assertions evaluate the median.

### Soft-fail period

The workflow currently runs with `continue-on-error: true`. Failures do
not block merge while baselines settle. **Flip to `false`** once the suite
has produced stable results against `main` for ~2 weeks. Tighten the
budgets at the same time — the starting values in `budgets.json` are
intentionally lenient.

## Budgets

### Resource sizes — `tests/lighthouse/budgets.json`

Per-path budgets in **kilobytes** (Lighthouse's unit). Defaults apply to
`/*`; add per-path entries to override:

```json
[
  { "path": "/*",
    "resourceSizes": [
      { "resourceType": "script",     "budget": 250 },
      { "resourceType": "stylesheet", "budget": 80  },
      ...
    ]
  },
  { "path": "/shop/",
    "resourceSizes": [
      { "resourceType": "image", "budget": 600 }
    ]
  }
]
```

Allowed `resourceType`: `document`, `script`, `stylesheet`, `image`,
`media`, `font`, `other`, `total`, `third-party`.

### Timing budgets — also `budgets.json`

Milliseconds. Lighthouse's `timings` array doesn't accept CLS — that one
lives in the lhci assertions below.

### Lighthouse category scores — `lighthouserc.json`

| Category        | Threshold | Severity |
| --------------- | --------- | -------- |
| Performance     | ≥ 0.70    | error    |
| Accessibility   | ≥ 0.90    | error    |
| Best Practices  | ≥ 0.90    | warn     |
| SEO             | ≥ 0.90    | warn     |
| CLS             | ≤ 0.10    | error    |

## Tuning the budgets

1. Run `pnpm lighthouse:run` locally to capture current values.
2. Open the HTML reports in `.lighthouseci/` to see actual resource sizes
   and timings.
3. Edit `tests/lighthouse/budgets.json` to set budgets at ~10–15% headroom
   above the current baseline.
4. Re-run to confirm the suite still passes against the new budgets.
5. Commit both the report-driven baseline conclusions and the updated
   budgets.

## Debugging a failure

1. Open the failing PR run; scroll to the `lighthouse-ci` job.
2. The temporary-public-storage URL is logged near the bottom — open it
   for an interactive Lighthouse report on the failing URLs.
3. Download the `.lighthouseci-<run-id>` artifact for the local HTML reports.
4. The GH check annotations on the PR list each violation with the URL,
   audit, expected, and actual values.

## Adding a new URL to the suite

1. Add the URL to `lighthouserc.json` under `ci.collect.url`.
2. If the URL needs different budgets than `/*`, append a per-path entry
   to `tests/lighthouse/budgets.json`.
3. Run `pnpm lighthouse:run` locally and tune if needed.
4. Commit.

## Trend tracking

**Not implemented in v1.** The temporary-public-storage upload gives a
shareable report per run but doesn't persist beyond ~7 days. If you want
in-repo trend history later, options are:

- Commit a small JSON summary per main-merge to `tests/lighthouse/history/`
  via a bot.
- Self-host `@lhci/server` and point `upload.target` at it.

Open an issue when this becomes a real need.

## Related

- `tests/visual/` — the visual regression suite. Shares the seed script
  and Docker boot; runs a complementary check on rendered output.
- `tests/visual/seed.sh` — the deterministic content seeder both suites
  depend on for stable runs.
