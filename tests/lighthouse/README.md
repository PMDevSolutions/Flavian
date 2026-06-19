# Lighthouse CI / Performance Budgets

Enforces Lighthouse category scores, Core Web Vitals (CLS), and page-weight
budgets against `themes/flavian-shop/` on every PR that touches theme code.
Runs via [`@lhci/cli`](https://github.com/GoogleChrome/lighthouse-ci) inside
the same Docker WP stack the visual regression suite uses.

**These are hard gates.** Any regression past a threshold makes
`pnpm lighthouse:assert` exit non-zero and **fails the PR check** — there is no
soft-fail / advisory mode.

## TL;DR

```bash
# One-time setup:
pnpm install
pnpm playwright:install        # only if you don't have Chrome locally

# Boot + seed the stack the budgets run against (same as CI):
docker compose up -d wordpress db
bash tests/visual/seed.sh

# Run the full suite locally (collect + assert + upload):
pnpm lighthouse:run            # exits non-zero if any budget regresses

# Or run the two phases separately while debugging:
pnpm lighthouse:collect        # gather LHRs into .lighthouseci/
pnpm lighthouse:assert         # the hard gate — assert against lighthouserc.json

# Inspect the HTML reports:
pnpm lighthouse:open
```

`pnpm lighthouse:run` expects WordPress to be reachable at
`http://localhost:8080/` with the four audited URLs seeded — it does **not**
boot Docker for you.

## Files

```
lighthouserc.json                    ← lhci config: URLs + the enforced assertions (SOURCE OF TRUTH)
tests/lighthouse/
├── README.md                        ← you are here
└── annotate-report.mjs              ← parses lhci output, emits GH check annotations
.github/workflows/lighthouse-ci.yml  ← CI orchestration (collect → assert → upload → annotate)
```

There is **no `budgets.json`.** Lighthouse 12 removed the budgets feature
(the `performance-budget` / `timing-budget` audits no longer ship, and a
`budgetsPath` setting is ignored), so every threshold is expressed as an
`lhci` **assertion** in `lighthouserc.json` instead — see
[Budgets](#budgets) below.

## What runs in CI

`.github/workflows/lighthouse-ci.yml` triggers on PRs touching `themes/**`,
`tests/lighthouse/**`, or `lighthouserc.json`. It:

1. Boots `docker compose up -d wordpress db` and installs WordPress core.
2. Installs WooCommerce via the `woocommerce-installer` profile (no sample data).
3. Runs `tests/visual/seed.sh` for deterministic content (shared with visual regression).
4. **Collects** — `pnpm lighthouse:collect` runs each URL `numberOfRuns: 3`
   times into `.lighthouseci/`.
5. **Asserts (hard gate)** — `pnpm lighthouse:assert` evaluates the median run
   against the assertions in `lighthouserc.json`. Any `error`-level miss exits
   non-zero and **fails the job**.
6. **Uploads** to LHCI's **temporary-public-storage** — a shareable URL appears
   in the log (viewable ~7 days). Runs even on a red gate so reviewers can open
   the report.
7. **Annotates** — `annotate-report.mjs` surfaces each violation as a native
   GitHub Check annotation (`::error title=...::`).

### URLs covered

| URL                             | Why                                                |
| ------------------------------- | -------------------------------------------------- |
| `/`                             | Homepage — always hit                              |
| `/shop/`                        | Heaviest template (product grid, images, JS)       |
| `/product/test-hoodie/`         | Single-product render — WC adds significant assets |
| `/cart/`                        | Catches cart-block JS regressions                  |

Each URL is run `numberOfRuns: 3` times; assertions evaluate the median.

## Budgets

All thresholds live in `lighthouserc.json` under `ci.assert.assertions` and are
enforced at `error` level (they fail the build).

### Category scores + Core Web Vitals

| Assertion                     | Threshold        | Severity |
| ----------------------------- | ---------------- | -------- |
| `categories:performance`      | ≥ 0.85           | error    |
| `categories:accessibility`    | ≥ 0.95           | error    |
| `categories:best-practices`   | ≥ 0.90           | error    |
| `categories:seo`              | ≥ 0.95           | error    |
| `cumulative-layout-shift`     | ≤ 0.10           | error    |

### Resource (page-weight) budgets

Expressed as `resource-summary:<type>:size` assertions. The value is
**`maxNumericValue` in bytes** — Lighthouse reports `transferSize`, the
over-the-wire size. The dev/CI stack enables Apache `mod_deflate` (see the repo
[`Dockerfile`](../../Dockerfile)), so JS/CSS are served **gzipped** and these
budgets are measured against the gzipped size, as the "gz" labels intend. Drop
`mod_deflate` and the same KB budgets would be measured against raw bytes —
roughly 3× stricter.

| Assertion                            | Budget       | Bytes (`KB × 1024`) |
| ------------------------------------ | ------------ | ------------------- |
| `resource-summary:script:size`       | JS ≤ 200 KB  | `204800`            |
| `resource-summary:stylesheet:size`   | CSS ≤ 50 KB  | `51200`             |
| `resource-summary:image:size`        | Images ≤ 500 KB (page total) | `512000` |

`resource-summary:image:size` is the **total** image weight on the page (the
`image` row aggregates every image request).

Valid `resource-summary` types: `document`, `script`, `stylesheet`, `image`,
`media`, `font`, `other`, `total`, `third-party` — each supports `:size` (bytes)
and `:count` (request count).

### Why assertions, not a `budgets.json`

`lhci assert` can read a `budgets.json` via its `budgetsFile` option **or**
take inline `assertions`, but [not both][lhci-assert] — and we need the
category `assertions`. Inlining `resource-summary:*:size` keeps every threshold
in one file and is the only budget mechanism that still works under
Lighthouse 12.

[lhci-assert]: https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md#assert

### Skipped audits

`ci.collect.settings.skipAudits` drops audits that can **only** fail because CI
serves the site over `http://localhost` — environment artifacts, not
theme-quality signals:

- `is-on-https` — weight 5/30 (~17%) of best-practices; always fails on http,
  so it alone would cap best-practices below the 0.90 gate.
- `uses-http2` — a weight-0 perf diagnostic localhost can't satisfy.

Remove an entry only if/when CI serves that scenario for real (e.g. HTTPS).

## Tuning the budgets

The budgets are intentionally strict. If a change legitimately needs more
headroom (a justified new script, font, or hero image), bump the threshold in
the **same PR** and explain it in the commit body:

1. Run `pnpm lighthouse:run` locally (stack booted + seeded) to capture current
   values, or open the PR's temporary-public-storage report.
2. Open the HTML reports (`pnpm lighthouse:open`) and read the **actual**
   `transferSize` per resource type from the *Resources Summary* / network
   panel.
3. Edit the relevant assertion in `lighthouserc.json`:
   - Category / CLS: change `minScore` / `maxNumericValue`.
   - Resource size: set `maxNumericValue` to **`new_KB × 1024`** bytes, with
     ~10–15% headroom above the real value.
4. Re-run `pnpm lighthouse:assert` to confirm the suite passes against the new
   threshold.
5. Commit the change and justify it in the body.

> First-run calibration: because these gates were just tightened, the seeded
> `flavian-shop` theme may legitimately miss a threshold (e.g. SEO if a template
> lacks a meta description, or performance on the JS-heavy WooCommerce pages).
> Fix the theme where the signal is real; only adjust a threshold when the miss
> is an environment artifact, and say so in the commit.

## Debugging a failure

1. Open the failing PR run; scroll to the `lighthouse-ci` job → **Assert
   performance budgets** step. Each failed assertion prints `expected` vs
   `found` (and `all values:` across the 3 runs).
2. The temporary-public-storage URL is logged in the **Upload** step — open it
   for an interactive Lighthouse report on the failing URLs.
3. The GH check annotations on the PR list each violation with the URL, audit,
   expected, and actual values.

## Adding a new URL to the suite

1. Add the URL to `lighthouserc.json` under `ci.collect.url`.
2. If the URL needs different budgets than the global ones, split the
   assertions into an `assertMatrix` keyed by `matchingUrlPattern` (note:
   `assertMatrix` replaces `assertions` — it can't be combined with it).
3. Run `pnpm lighthouse:run` locally and tune if needed.
4. Commit.

## Trend tracking

**Not implemented.** The temporary-public-storage upload gives a shareable
report per run but doesn't persist beyond ~7 days. If you want in-repo trend
history later, options are:

- Commit a small JSON summary per main-merge to `tests/lighthouse/history/`
  via a bot.
- Self-host `@lhci/server` and point `upload.target` at it.

Open an issue when this becomes a real need.

## Related

- `tests/visual/` — the visual regression suite. Shares the seed script
  and Docker boot; runs a complementary check on rendered output.
- `tests/visual/seed.sh` — the deterministic content seeder both suites
  depend on for stable runs.
- [`CONTRIBUTING.md` → Performance budgets](../../CONTRIBUTING.md#performance-budgets)
  — the contributor-facing summary of how to update budgets.
