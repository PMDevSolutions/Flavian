---
name: lint
description: Run this repository's linters and standards checks (WordPress PHPCS, the security and performance scans, the Claude Code conformance check, documentation counts, commitlint, the GUI lint) and report what failed. Keywords: lint, phpcs, coding standards, security scan, conformance, commitlint
argument-hint: [themes/<slug> | plugins/<slug> | all]
allowed-tools: Bash(./scripts/wordpress/*), Bash(bash scripts/*), Bash(node scripts/*), Bash(pnpm lint:*), Bash(pnpm gui:lint), Bash(pnpm gui:typecheck), Read, Glob
---

# /lint — run the repository's checks

Target: `$ARGUMENTS`. A theme or plugin directory (`themes/flavian-shop`, `plugins/my-block`), or `all`. With no argument, check every directory under `themes/` and `plugins/` that has a `style.css` or a plugin header.

This repo is WordPress (PHP), Node and shell. There is no Python here; the Python linters an older copy of this command described never applied.

## What runs

| Check | Command | Catches |
|-------|---------|---------|
| WordPress coding standards | `./scripts/wordpress/check-coding-standards.sh <path>` | PHPCS with the WordPress rulesets (set up once with `./scripts/wordpress/setup-phpcs.sh`) |
| Security scan | `./scripts/wordpress/security-scan.sh <path>` | unescaped output, unsanitised input, missing nonces and capability checks, raw SQL |
| Performance | `./scripts/wordpress/check-performance.sh <path>` | unoptimised assets, unconditional enqueues, expensive queries |
| Theme structure | `./scripts/validate-theme.sh <theme>` | theme.json, templates, parts, root-level layout |
| Claude Code configuration | `node scripts/claude-code-conformance.js` | retired tool names, bad frontmatter, dead hooks, plugin manifest drift |
| Documentation counts | `bash scripts/check-doc-counts.sh` | "N agents" / "N skills" claims that drifted from disk |
| Commit messages | `pnpm lint:commits` | Conventional Commits since `origin/main` (release-please reads them) |
| GUI | `pnpm gui:lint && pnpm gui:typecheck` | `packages/gui` only; run when GUI files changed |

## Steps

1. Resolve the target directories. Skip a PHP check for a directory with no PHP.
2. Run every applicable check and keep going after a failure; capture each exit code.
3. Report a table: check, pass or fail, the first failing lines, the exact command to re-run.
4. Fix nothing silently. List the fixes you would make; apply them only if the user asked to fix lint, and re-run the failed checks afterwards.

A hook already reminds you to run the full gate after a standards check passes (`post-bash-reminders.sh build-qa`); `/lint all` is that gate.
