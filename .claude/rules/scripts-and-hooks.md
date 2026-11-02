---
paths:
  - "scripts/**"
  - ".claude/hooks/**"
  - "tests/**"
---

# Scripts, hooks and tests

- Bash runs on the macOS system bash 3.2 as well as Linux bash 5 in CI. Avoid `grep -P`, `${var,,}` and `${var^^}`, `mapfile`/`readarray`, associative arrays (`declare -A`), `&>>` and GNU `find -printf`; `sed -i` needs the macOS form (`sed -i ''`) or `perl -pi`. With `set -u`, guard empty-array expansions.
- Exit codes: 0 pass, 1 check failed, 2 usage or input error. A script other tooling reads takes `--json`.
- Scripts under `scripts/<agent>/` are agent-scoped hooks: they read the event JSON on stdin (`INPUT=$(cat)`, `jq -r '.tool_input.file_path'`); most also accept a path argument for manual use. The three `scripts/*-fse/validate-theme-location.sh` files `exec` the project hook.
- Project hooks live in `.claude/hooks/` on `lib/hook-io.sh` (contract) and `lib/flavian-helpers.sh` (Bash output, commit detection, carried files), with the skeleton `set -u`, `trap 'exit 0' ERR`, `|| true` inside `$( )`, always exit 0. Registration is in `.claude/settings.json` and mirrored in `.claude/hooks/hooks.json`.
- Shell tests are bats (`tests/bats/bin/bats <dir or file>`; the runner and helpers are git submodules: `git submodule update --init --recursive`). Node tests are `node:test` (`tests/init`, `tests/claude-code`; `pnpm test:init`, `pnpm test:claude`). The pipeline package has its own suite (`pnpm test:pipeline`); the Docker-backed e2e suites are `pnpm test:canva-e2e`, `test:headless-e2e`, `test:visual`, `test:lighthouse`.
- Every hook has cases in `tests/claude-code/hooks.test.mjs` (contract plus behaviour); every change to `scripts/claude-code-conformance.js` or `scripts/check-doc-counts.sh` gets a case in `tests/claude-code/`.
- A new check is wired into the matching workflow under `.github/workflows/` (`validate-configs.yml` for anything under `.claude/`) and listed in `scripts/README.md`.
- Never write a credential, a hostname with a username, or a key path into a script, a hook message or a test fixture. Deployment configs live in `.claude/config/deployment/<env>.yml`, which is gitignored.
