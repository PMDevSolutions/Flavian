# Interactive CLI Setup Wizard — Design

**Issue:** #21 — Create interactive CLI setup wizard
**Branch:** `21-create-interactive-cli-setup-wizard`
**Date:** 2026-05-20

## Goal

One-line project initialization for the Flavian template via `npx create-flavian <name>` or `composer create-project pmds/flavian <name>`. Interactive prompts capture project name, theme starter, design-tool source, and WooCommerce support. Auto-configures Docker `.env`, theme files, and runs an initial git commit. Supports `--yes` for non-interactive runs.

## Architecture

Two entry points share one core wizard:

```
@pmds/create-flavian (npm)        pmds/flavian (composer)
        │                                  │
        ▼                                  ▼
   bin/index.mjs ─────── delegates ──── post-create-project-cmd
        │                                  │
        ▼                                  ▼
   tarballs/clones template ──── runs scripts/init.mjs (in user dir)
```

- **`npx create-flavian my-site`** — tiny published package (`@pmds/create-flavian`). `bin/index.mjs` downloads the latest Flavian release tarball, extracts to `my-site/`, then spawns `node scripts/init.mjs`. Bootstrap stays <50 lines.
- **`composer create-project pmds/flavian my-site`** — Composer clones this repo. A `post-create-project-cmd` in `composer.json` runs `node scripts/init.mjs`.
- **`scripts/init.mjs`** — the real wizard. Ships with the template so it evolves in lockstep with theme/config changes.
- **Prompts**: `@clack/prompts` (single dep, ~80kb, clean cancel semantics).
- **Composition**: shells out to existing scripts (`scaffold-plugin.sh`, `setup-woocommerce.sh`, validators). Wizard orchestrates, doesn't duplicate.
- **State**: every choice collected into one `WizardConfig` object; a single `apply(config)` pass writes files. Makes `--yes`, `--dry-run`, and tests trivial.

## Wizard Flow

```
1. Project name         (default: cwd basename, slugified, validated)
2. Site title           (default: title-cased project name)
3. Theme starter        Blank FSE | flavian-shop | Figma placeholder | InDesign placeholder
4. WooCommerce?         (auto-yes & hidden when theme = flavian-shop)
5. Local dev port       (default 8080; 1024–65535, must be free)
6. Admin email          (default: git config user.email)
7. Confirm → proceed
```

Branching is minimal: WooCommerce is the only conditional. DB credentials use `.env.example` defaults — production overrides happen via the existing deployment scripts. Ctrl+C at any prompt returns clack's cancel symbol; wizard exits 130 with "Cancelled — no files written" (writes only happen in the apply phase).

## Apply Phase

```
apply(config)
├─ writeEnv(config)
│    cp .env.example .env; substitute SITE_URL, WP_PORT, WP_ADMIN_EMAIL,
│    DB_NAME (= projectName), WP_SITE_TITLE
├─ setupTheme(config)
│    blank        → scaffold themes/<slug>/ from .claude/templates/theme/
│    flavian-shop → cp -r themes/flavian-shop themes/<slug>/, rewrite headers
│    figma        → empty themes/, write docs/NEXT-STEPS.md pointing at
│                    figma-to-fse-autonomous-workflow
│    indesign     → same placeholder + "InDesign pipeline not yet implemented"
├─ setupWooCommerce(config)
│    if woocommerce && themeStarter !== 'flavian-shop':
│      stage scripts/wordpress-install/setup-woocommerce.sh as a post-install hook
├─ initGit(config)
│    rm -rf .git; git init -b main; git add -A;
│    git commit -m "chore: initial Flavian scaffold"
└─ verify(config)
```

**Constraints:**
- Templates live in this repo under `.claude/templates/theme/`. Wizard never downloads mid-run (other than the initial tarball for the npx path).
- Token substitution via a single helper that walks the target dir and replaces `{{THEME_SLUG}}` / `{{THEME_NAME}}` / `{{SITE_TITLE}}` — no regex over arbitrary content.
- No `.claude/settings.json` edits in v1 (idempotency risk; not in scope).
- Failures roll back files written during this run via a `try/finally` cleanup that records every written path.

## Verification

Static-only checks, no Docker. Runs in order, fails fast (<10s total):

```
1. jq empty themes/<slug>/theme.json
2. Required files exist: style.css, theme.json, templates/index.html
3. ./scripts/validate-agent-configs.sh
4. ./scripts/validate-theme.sh themes/<slug>   (skipped for figma/indesign)
5. .env present and non-empty
```

Each prints `✓ <name>` or `✗ <name>: <reason>` with a remediation hint. Verification failure leaves the scaffold in place so the user can fix and re-run.

## --yes / Non-Interactive Mode

```
node scripts/init.mjs --yes [--name=<slug>]
                            [--theme=blank|flavian-shop|figma|indesign]
                            [--woo] [--port=<n>] [--email=<addr>]
                            [--no-git]
```

- Missing values fall back to defaults (name=cwd basename, theme=`blank`, woo=`false` unless theme=`flavian-shop`, port=`8080`, email=`git config user.email` or `admin@example.com`).
- `--yes` skips the final confirmation only — validation still runs. Invalid flag values exit 2 with usage.
- `--no-git` skips `git init` (for test fixtures and CI).

## Final Output

```
✓ Project ready at ./my-site

Next steps:
  cd my-site
  cp .env.example .env       # already done — review values
  docker compose up -d        # boot WordPress at http://localhost:8080
  open http://localhost:8080/wp-admin

Resources:
  • Theme:        themes/my-site/
  • Docs:         CLAUDE.md, docs/QUICK-START.md
  • Skills:       .claude/skills/README.md
```

No emoji. Matches existing script style (`✓` / `✗`).

## Testing

```
tests/init/
├─ unit/
│   ├─ validate-name.test.mjs       slug rules, reserved words
│   ├─ default-resolver.test.mjs    --yes fills missing flags correctly
│   └─ token-substitute.test.mjs    {{THEME_SLUG}} replacement is safe
└─ integration/
    └─ smoke.test.mjs               full --yes run into mkdtemp dir
```

- Unit tests use Node's built-in `node:test` (no new dep). Cover pure functions only. <1s total.
- Integration smoke test runs `node scripts/init.mjs --yes --no-git --name=test-site --theme=<each>` into a `mkdtemp` dir, then asserts file presence, `.env` content, and that `validate-theme.sh` passes. Re-running in the same dir refuses cleanly. ~15s total.
- CI: new `init-wizard` job on the existing GitHub Actions workflow.
- **Out of scope**: end-to-end testing of the published `@pmds/create-flavian` bootstrap — that needs registry publishing. We test the inner wizard only.

## File Inventory

New:
- `scripts/init.mjs` — the wizard
- `scripts/init/` — internal modules (prompts, generators, validators)
- `.claude/templates/theme/` — blank FSE theme template
- `tests/init/` — unit + integration tests
- `docs/CLI-WIZARD.md` — user-facing docs
- `@pmds/create-flavian/` — separate published package (small, 1 file + manifest)

Modified:
- `composer.json` — add `post-create-project-cmd` hook
- `package.json` — add `@clack/prompts` dep, `init` script
- `.github/workflows/<ci>.yml` — add `init-wizard` job
- `README.md` — add quick-start section

## Out of Scope (deferred)

- Docker smoke test in verification (slow, platform-fragile on Windows)
- `.claude/settings.json` mutation (idempotency risk)
- Multi-theme generation in one run
- Re-running wizard against existing project (today: refuses cleanly)
- InDesign-to-FSE pipeline (placeholder only)
