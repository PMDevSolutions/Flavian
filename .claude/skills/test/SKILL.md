---
name: test
description: Run this repository's test suites (bats shell tests, the Node suites for the CLI wizard, the InDesign pipeline, the Claude Code configuration and hooks, the GUI, PHPUnit for a theme or plugin, the Docker-backed end-to-end suites) and report failures by name. Keywords: test, bats, node --test, phpunit, pest, test suite, e2e
argument-hint: [bats | init | pipeline | claude | gui | php <path> | e2e | all]
allowed-tools: Bash(tests/bats/bin/bats:*), Bash(node --test:*), Bash(pnpm test:*), Bash(pnpm gui:test), Bash(vendor/bin/phpunit:*), Bash(git submodule update:*), Read, Glob
---

# /test — run the suites

Suite from `$ARGUMENTS`; the default is `all`, which runs everything except `e2e` (those need the Docker stack).

This repo tests shell with bats, Node with `node:test`, and PHP with PHPUnit. There is no pytest here; the Python test runners an older copy of this command described never applied.

| Suite | Command | Needs |
|-------|---------|-------|
| `bats` | `tests/bats/bin/bats tests/unit tests/figma-fse tests/canva-fse tests/validate-agent-configs.bats` | the vendored submodules: `git submodule update --init --recursive` |
| `init` | `pnpm test:init` | Node 22+ |
| `pipeline` | `pnpm test:pipeline` | `pnpm install` |
| `claude` | `pnpm test:claude` (`node --test tests/claude-code/*.test.mjs`) | Node, jq; covers the hooks, the conformance check and the doc-count check |
| `gui` | `pnpm gui:test` | `pnpm install` |
| `php <path>` | `cd <path> && vendor/bin/phpunit` | `composer install` inside the theme or plugin (`scripts/scaffold-block.sh` writes a `phpunit.xml.dist`) |
| `e2e` | `pnpm test:canva-e2e`, `pnpm test:headless-e2e`, `pnpm test:visual`, `pnpm test:lighthouse` | `docker compose up -d wordpress db` (see LOCAL-DEVELOPMENT.md) |

## Steps

1. Run the chosen suite(s). Keep going after a failure.
2. Read the output. Report every failing test by name with its first assertion message; a failure you did not cause still goes in the report.
3. Never edit a test to make it pass. If a test is wrong, say why and propose the change.
4. After the run, the `post-bash-reminders.sh` hooks may add a coverage or mutation-testing note; mention it in the report when it applies.
