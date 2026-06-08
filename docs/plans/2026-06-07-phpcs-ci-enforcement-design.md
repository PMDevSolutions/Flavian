# PHPCS CI Enforcement — Design & Baseline

**Issue:** #84 — Run PHPCS in CI
**Milestone:** v2.0.0
**Date:** 2026-06-07

## Problem

`scripts/wordpress/setup-phpcs.sh` and `scripts/wordpress/check-coding-standards.sh`
existed, but no GitHub Actions workflow enforced WordPress Coding Standards on
pull requests. A `phpcs.yml` workflow had been added previously, but it:

- linted with three duplicated inline `phpcs` invocations (standard + ignore
  lists copy-pasted per directory) rather than a single versioned config;
- did **not** invoke `check-coding-standards.sh` (the script named in the issue);
- had no protection against a future CRLF commit silently breaking the gate;
- was undocumented for local use in `CONTRIBUTING.md`.

## Baseline (the "grandfather existing offenses" criterion)

Measured on 2026-06-07. **The codebase already lints clean on the content CI
sees, so there is nothing to grandfather.**

The 9 violations observed on a Windows working tree were all
`Generic.Files.LineEndings` (CRLF) errors — a local artifact of
`core.autocrlf=true`. Git stores every PHP file as **LF** (`git ls-files --eol`
reports `i/lf`). Running PHPCS against the LF blob content (exactly what an
Ubuntu runner checks out) reports zero violations:

```
$ # extract git-stored (LF) content and lint with the CI standard
$ php vendor/bin/phpcs --standard=WordPress-Extra,WordPress-Docs \
    --extensions=php <lf-copies-of themes/ mu-plugins/ plugins/>
$ echo $?
0   # zero errors, zero warnings
```

Scope linted: `themes/**` (8 files), `mu-plugins/**` (2 files), and non-bundled
`plugins/**`. First-party `plugins/flavian-*` are excluded here because they
carry their own `.phpcs.xml.dist` and are linted by the `plugin-validation`
workflow; `akismet`, `hello.php`, and WordPress `index.php` guard stubs are
also excluded.

## Decisions

1. **No baseline file.** The tree is already clean, so a PHPCS baseline /
   ignore-list would be empty machinery (YAGNI). Instead, add a `.gitattributes`
   that pins LF line endings so the most likely future failure (a CRLF commit)
   can never trip the line-ending sniff. PHPCS becomes a hard gate immediately.
2. **Single versioned config.** Replace the three inline `phpcs` invocations
   with a root `phpcs.xml.dist` (standard, scan targets, and exclusions in one
   place). CI, Composer scripts, and the local script all use it.
3. **`check-coding-standards.sh` becomes dual-mode.** It keeps its existing
   Claude Code PostToolUse **hook** behaviour (reads tool JSON on stdin, advisory,
   always exits 0) and gains a **CLI/CI** mode (lints paths or the project,
   `--strict` to exit non-zero). This honours the issue (CI runs the named
   script), fixes the previously-broken `composer check-standards`, and makes
   the `check-coding-standards.sh themes/` / `--strict` forms already referenced
   in agent docs actually work.
4. **Required check is documented, not auto-applied.** Branch protection /
   rulesets cannot live in a workflow file; `CONTRIBUTING.md` tells a maintainer
   how to mark the **WordPress Coding Standards** check required for `main`.

## Implementation

| File | Change |
| ---- | ------ |
| `phpcs.xml.dist` | New. `WordPress-Extra` + `WordPress-Docs`; scans `themes/`, `plugins/`, `mu-plugins/`; excludes `*/index.php`, `plugins/akismet/*`, `plugins/hello.php`, `plugins/flavian-*/*`, `vendor`, `node_modules`. |
| `.gitattributes` | New. `* text=auto`; `*.php`/`*.sh` forced `eol=lf`; `*.bat`/`*.cmd` `eol=crlf`; binary assets protected. |
| `scripts/wordpress/check-coding-standards.sh` | Refactor to dual-mode (hook + CLI/`--strict`), driven by `phpcs.xml.dist`. |
| `.github/workflows/phpcs.yml` | Run `check-coding-standards.sh --strict -q --report=checkstyle | cs2pr` (inline PR annotations + hard fail; `-q` keeps the checkstyle stdout clean for cs2pr); cache Composer deps. No `paths:` filter so the job always completes and is safe to mark a required check. |
| `composer.json` | `phpcs`/`phpcbf` use the config; `check-standards` calls the script with `--strict`. |
| `CONTRIBUTING.md` | Document local PHPCS usage, auto-fix, LF note, and how to make the check required. |

### Why no `paths:` filter on the trigger

A required status check that is path-filtered shows as *pending* on PRs that
don't touch its paths, which blocks merges (GitHub's well-known
skipped-required-check footgun). The job is cheap (≈10 tracked PHP files), so it
runs on every PR to `main` and passes trivially when no PHP changed — keeping it
safe to require.
