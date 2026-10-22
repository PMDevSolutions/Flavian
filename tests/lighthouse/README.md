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
5. **Asserts (hard gate)** — `pnpm lighthouse:assert` evaluates the **best** of
   the 3 runs against the assertions in `lighthouserc.json` (see
   [URLs covered](#urls-covered)). Any `error`-level miss exits non-zero and
   **fails the job**.
6. **Uploads** to LHCI's **temporary-public-storage** — a shareable URL appears
   in the log (viewable ~7 days). Runs even on a red gate so reviewers can open
   the report.
7. **Annotates** — `annotate-report.mjs` surfaces each violation as a native
   GitHub Check annotation (`::error title=...::`).
8. **Uploads the reports artifact** — the raw `.lighthouseci/` directory (LHR
   JSON + HTML reports) is attached to the run as the `lighthouse-reports`
   artifact (30-day retention). This is the canonical place to read the
   *specific* failing audits when a category score misses its floor — the
   temporary-public-storage link expires after ~7 days.

### URLs covered

| URL                             | Why                                                |
| ------------------------------- | -------------------------------------------------- |
| `/`                             | Homepage — always hit                              |
| `/shop/`                        | Heaviest template (product grid, images, JS)       |
| `/product/test-hoodie/`         | Single-product render — WC adds significant assets |
| `/cart/`                        | Catches cart-block JS regressions                  |

Each URL is run `numberOfRuns: 3` times. `lighthouserc.json` sets no
`aggregationMethod`, so `lhci assert` uses its default, **`optimistic`**: each
assertion is checked against the *best* run — the highest score for `minScore`,
the lowest value for `maxNumericValue`. A failure therefore means **all three
runs** missed the threshold.

## Budgets

All thresholds live in `lighthouserc.json` under `ci.assert.assertMatrix` and are
enforced at `error` level (they fail the build). Budgets are split into **two
URL classes** because a WooCommerce storefront has two kinds of page, each gated
by exactly one (mutually exclusive) `matchingUrlPattern`:

- **Content pages** — `/`, `/shop/`, `/product/…` — indexable and light on JS.
- **Functional pages** — `/cart/`, `/checkout/`, `/my-account/` — WooCommerce
  marks these `noindex` by design (so **SEO is not asserted** — Lighthouse's
  `is-crawlable` correctly fails on a noindex page), and the Cart/Checkout
  *blocks* ship a large React bundle (so the **script budget is raised**).

### Category scores + Core Web Vitals

| Assertion                     | Content pages | Functional pages | Severity |
| ----------------------------- | ------------- | ---------------- | -------- |
| `categories:performance`      | ≥ 0.85        | ≥ 0.50           | error    |
| `categories:accessibility`    | ≥ 0.95        | ≥ 0.95           | error    |
| `categories:best-practices`   | ≥ 0.90        | ≥ 0.90           | error    |
| `categories:seo`              | ≥ 0.95        | — (noindex)      | error    |
| `cumulative-layout-shift`     | ≤ 0.10        | ≤ 0.10           | error    |

The a11y/SEO floors are **0.95** (raised from the 0.90 calibration floor in
issue #125). Content SEO reaches 1.0 because the theme emits its own
`meta-description` via `inc/seo.php` — no SEO plugin required. The a11y floor
sits just under the observed 0.96–0.97 because of WooCommerce-owned markup the
theme can't fix — see [Known residual audits](#known-residual-audits).

### Functional-page performance floor

Functional pages are floored at **0.50**, not 0.85, because a working Cart
block can't reach 0.85 under Lighthouse's mobile simulation — and the theme
can't change why:

- The Cart block renders **client-side**. Its LCP element (for the empty cart
  Lighthouse sees: the "New in store" product grid) only paints once
  WooCommerce's React app has mounted, i.e. after **~730 KB gz** of
  WooCommerce + WordPress-core JS (including `wp-components`, ~270 KB) has
  executed. Lantern therefore puts all of that JS on the LCP critical path:
  simulated LCP is **~7–8 s on every run** (LCP score ≈ 0.05, weight 25).
- Mounting also swaps the loading skeleton for real content, which nudges the
  footer (CLS 0.04, occasionally ~0.2).

Measured on a working cart (WooCommerce 11.2.1, WordPress 7.1, 15 runs):
performance **0.44–0.66** per run (median 0.57), FCP ~2.2 s, TBT 0.3–0.8 s on
a CPU slower than the CI runners. With best-of-3 aggregation even the three
lowest of those runs together (0.44, 0.50, 0.51) clear 0.50, so the floor
passes a healthy cart while still failing a real regression (TBT blow-up,
sustained CLS, render-blocking CSS). The precise
cart gates are the budgets that don't depend on simulation: script ≤ 800 KB,
CSS ≤ 50 KB, CLS ≤ 0.1, a11y/best-practices floors.

Don't raise this floor back toward 0.85 unless the cart's LCP stops depending
on the Cart block bundle (e.g. the classic `[woocommerce_cart]` shortcode — a
UX trade-off, see issue #125). Earlier calibrations only cleared 0.85 because
`page-cart.html` used a bare `<!-- wp:woocommerce/cart /-->`, which renders
**nothing** — see the calibration history below.

### Known residual audits

These are the audits that keep content-page a11y below 1.0. They come from
**WooCommerce's own block markup**, not the theme — do not try to "fix" them in
theme templates, and account for them before tightening the a11y floor further:

- **`aria-hidden-focus`** (weight 7, fails on `/`, `/shop/`, `/product/…`) —
  the Mini-Cart drawer (`wp:woocommerce/mini-cart` in `parts/header.html`)
  renders `aria-hidden="true"` with focusable descendants (close button, links)
  until the Interactivity API hydrates and takes over via
  `data-wp-bind--aria-hidden`. Lighthouse audits the pre-hydration DOM.
  Removing the mini-cart from the header would "fix" the score at the cost of a
  core storefront feature.

The theme-controlled audits that used to fail here (`list` — core's page-list
fallback nesting `<ul>` inside the navigation `<ul>` when no menu links are
defined; `heading-order` — `h1 → h3` skips in the product grids and footer)
were fixed in issue #125 by giving `wp:navigation` explicit inner links and
normalizing heading levels. Quantity inputs and product-grid image links in
WooCommerce blocks are also WC-owned, but currently pass.

### Resource (page-weight) budgets

Expressed as `resource-summary:<type>:size` assertions. The value is
**`maxNumericValue` in bytes** — Lighthouse reports `transferSize`, the
over-the-wire size. The dev/CI stack enables Apache `mod_deflate` (see the repo
[`Dockerfile`](../../Dockerfile)), so JS/CSS are served **gzipped** and these
budgets are measured against the gzipped size, as the "gz" labels intend. Drop
`mod_deflate` and the same KB budgets would be measured against raw bytes —
roughly 3× stricter.

| Assertion                            | Content pages          | Functional pages       |
| ------------------------------------ | ---------------------- | ---------------------- |
| `resource-summary:script:size`       | JS ≤ 200 KB (`204800`) | ≤ 800 KB (`819200`)    |
| `resource-summary:stylesheet:size`   | CSS ≤ 50 KB (`51200`)  | CSS ≤ 50 KB (`51200`)  |
| `resource-summary:image:size`        | ≤ 500 KB (`512000`)    | ≤ 500 KB (`512000`)    |

`resource-summary:image:size` is the **total** image weight on the page (the
`image` row aggregates every image request). The functional-page script budget
(~800 KB gz) reflects the WooCommerce Cart/Checkout blocks; the classic
`[woocommerce_cart]` shortcode would cut it ~6× (UX tradeoff — see issue #125).

Valid `resource-summary` types: `document`, `script`, `stylesheet`, `image`,
`media`, `font`, `other`, `total`, `third-party` — each supports `:size` (bytes)
and `:count` (request count).

### Why assertions, not a `budgets.json`

`lhci assert` can read a `budgets.json` via its `budgetsFile` option **or** take
inline `assertions` / `assertMatrix`, but [not both][lhci-assert] — and we need
category assertions and per-URL budgets. Inlining `resource-summary:*:size` into
the `assertMatrix` keeps every threshold in one file and is the only budget
mechanism that still works under Lighthouse 12.

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
3. Edit the relevant assertion in `lighthouserc.json`. Note there are **two
   `assertMatrix` entries** — change the one whose `matchingUrlPattern` matches
   the URL (content vs. functional), or both if the budget is global:
   - Category / CLS: change `minScore` / `maxNumericValue`.
   - Resource size: set `maxNumericValue` to **`new_KB × 1024`** bytes, with
     ~10–15% headroom above the real value.
4. Re-run `pnpm lighthouse:assert` to confirm the suite passes against the new
   threshold.
5. Commit the change and justify it in the body.

> Calibration history: the first hard-gate run (PR #124) showed the seeded
> `flavian-shop` theme topping out at a11y ~0.94 and content SEO ~0.92, and that
> WooCommerce intentionally `noindex`es the cart (SEO 0.58) and ships a large
> cart-block bundle — so floors were set to 0.90 and the cart got its own budget
> class. Issue #125 then closed the gaps: the theme's own SEO layer
> (`inc/seo.php`, PR #116) brought content SEO to 1.0, and nav/heading fixes
> brought a11y to 0.96–1.0, so the a11y/SEO floors were raised to 0.95.
> Then a Dependabot PR that changed nothing on the site failed `/cart/`
> performance at 0.59 (runs 0.47/0.59/0.59) while a parallel run scored 0.90 on
> byte-identical pages. Root cause: `page-cart.html` and `page-checkout.html`
> used bare `<!-- wp:woocommerce/cart /-->` / `<!-- wp:woocommerce/checkout /-->`
> blocks, which render nothing — the cart page loaded the full Cart bundle but
> showed no cart, and with no images on the page all 61 blocking scripts got
> Chrome's "High" priority, so whether Lantern counted ~730 KB of JS as
> render-blocking depended on whether the runner happened to paint before
> executing it (simulated FCP 2.6 s vs 6.9 s). The templates now render the
> page's own content (`wp:post-content`, as WooCommerce's templates do), which
> fixes the cart and checkout and removes that FCP coin-flip — and the
> functional-page performance floor was recalibrated to the working cart
> (see [Functional-page performance floor](#functional-page-performance-floor)).
> Fix the theme where the signal is real; only adjust a threshold when the miss
> is an environment artifact or the page under test changed, and say so.

## Debugging a failure

1. Open the failing PR run; scroll to the `lighthouse-ci` job → **Assert
   performance budgets** step. Each failed assertion prints `expected` vs
   `found` (and `all values:` across the 3 runs).
2. The temporary-public-storage URL is logged in the **Upload** step — open it
   for an interactive Lighthouse report on the failing URLs.
3. The GH check annotations on the PR list each violation with the URL, audit,
   expected, and actual values.
4. Download the `lighthouse-reports` artifact for every run's LHR JSON — the
   `metrics` audit's `observed*` timings show what the runner actually did, as
   opposed to the simulated (Lantern) values that are scored. Note that with
   Lighthouse 12.1 (bundled by `@lhci/cli` 0.14) on current Chrome, the
   `largest-contentful-paint-element` and `layout-shifts` audits error out
   (`frame_sequence`), so identify the LCP element / shift sources in a real
   browser (DevTools Performance panel) instead.

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
