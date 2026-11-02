# Claude Code SOTA Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Flavian's `.claude/` configuration to conformance with Claude Code 2.1.316 (0 checker errors), move its hooks to the stdin contract, replace the legacy commands and TodoWrite tracking, and package the repo as the `flavian` plugin.

**Architecture:** Six commits in dependency order (hooks → agents → skills → rules/plugin/workflow/evals → checker and CI → docs), each leaving the repo runnable. Hooks are bash on `lib/hook-io.sh`; tests are `node:test` under `tests/claude-code/` plus the existing bats suites; the checker is the Maecenas script copied verbatim with a bumped spec.

**Tech Stack:** bash 3.2-compatible shell, Node 22+ (`node:test`), bats-core (vendored submodules), jq, Claude Code 2.1.316 (`claude plugin validate`).

**Spec:** `docs/plans/2026-11-02-claude-code-conformance-design.md`

## Global Constraints

- Shell scripts run on macOS bash 3.2 and Linux bash 5: no `grep -P`, `mapfile`, `${var,,}`, associative arrays, GNU `find -printf`.
- Every hook: `set -u`, `trap 'exit 0' ERR`, sources `lib/hook-io.sh`, reads stdin, prints one JSON object or nothing, exits 0.
- Hook registration paths: `bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/<name>.sh` in `settings.json`; `bash "${CLAUDE_PLUGIN_ROOT}/.claude/hooks/<name>.sh"` in `hooks.json`.
- Agent tool names only from the spec's `builtinTools` and `mcp__<server>__*`; colors only `red blue green yellow purple orange pink cyan`.
- Documented counts after this plan: 53 agents, 16 skills, 0 installed plugins.
- Commit messages follow Conventional Commits (release-please reads `feat`/`fix`); end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Root-level layout: nothing is written under `wp-content/`.

## Review Focus

1. A `git commit` whose staged theme file contains `fill="#fff"` inside an inline SVG: the token guard must `ask` and show the line, never `deny` outright (Task 2 test "asks on a hex color in a staged pattern").
2. `deploy.sh --env production --dry-run` and `rollback.sh --env staging --list`: the deploy guard must stay silent (Task 2 test "stays silent on dry runs and listings").
3. The plugin's hooks running in a repo that tracks `wp-content/themes/`: the location guard must allow the write (Task 2 test "allows wp-content paths in a repo that tracks wp-content").
4. An agent whose `tools:` list is only MCP names after the rewrite (`visual-qa-agent`): it must still carry `Read, Write, Bash, Grep, Glob` (Task 3 verification step greps the file).
5. The doc-count check reading `docs/plans/2026-11-02-claude-code-conformance-design.md` ("53 agents", "16 skills") and `archive/`: both directories are excluded, so an older count there never fails CI (Task 5 test "ignores historical directories").

---

### Task 1: Branch, design record, and the checker available locally

**Files:**
- Create: `docs/plans/2026-11-02-claude-code-conformance-design.md`, `docs/plans/2026-11-02-claude-code-conformance.md` (this file)

- [ ] **Step 1: Branch from main**

Run: `git checkout -b feat/claude-code-conformance-167 main`

- [ ] **Step 2: Record the baseline**

Run: `node ../Maecenas/scripts/claude-code-conformance.js --root . --json > /tmp/baseline.json`
Expected: `"errors": 139, "warnings": 56`

- [ ] **Step 3: Commit the design and plan**

```bash
git add docs/plans/2026-11-02-claude-code-conformance-design.md docs/plans/2026-11-02-claude-code-conformance.md
git commit -m "docs(plans): design and plan for the Claude Code conformance pass (#167)"
```

### Task 2: Hooks on the stdin contract

**Files:**
- Create: `.claude/hooks/lib/hook-io.sh` (copy of Maecenas), `.claude/hooks/lib/flavian-helpers.sh`, `.claude/hooks/lib/session-context.mjs`, `.claude/hooks/deploy-guard.sh`, `.claude/hooks/agent-no-deploy.sh`, `.claude/hooks/pre-commit-token-guard.sh`, `.claude/hooks/bundle-size-guard.sh`, `.claude/hooks/post-bash-reminders.sh`, `.claude/hooks/session-context.sh`, `.claude/hooks/hooks.json`, `tests/claude-code/hooks.test.mjs`
- Modify: `.claude/hooks/validate-theme-location.sh`, `.claude/hooks/figma-fse-post-template.sh`, `.claude/hooks/figma-fse-completion.sh`, `.claude/settings.json`, `.mcp.json`, `.gitignore`, `scripts/figma-fse/validate-theme-location.sh`, `scripts/canva-fse/validate-theme-location.sh`, `scripts/indesign-fse/validate-theme-location.sh`, `tests/figma-fse/validate-theme-location.bats`

**Interfaces:**
- Produces: `hook_read_input`, `hook_read_context`, `hook_pretooluse_decision <allow|deny|ask> <reason>`, `hook_gate_decision <ask|deny> <reason>`, `hook_additional_context <Event> <text>`, `hook_project_dir` (from `hook-io.sh`); `flavian_bash_output` (stdout+stderr of a Bash `tool_response`, string or object) and `flavian_is_flavian_checkout <dir>` (from `flavian-helpers.sh`); `deploy-guard.sh [--subagent]`; `post-bash-reminders.sh <build-qa|coverage|dark-mode|mutation>`.

- [ ] **Step 1: Write the failing hook tests** in `tests/claude-code/hooks.test.mjs` (node:test). Helpers: `runHook(name, event, {cwd, projectDir, args})` feeding JSON on stdin with `CLAUDE_PROJECT_DIR`; `decision(out)`, `context(out)`; `tmpRepo()` making a git repo with `themes/demo/style.css` (Flavian layout) and `tmpWpContentRepo()` tracking `wp-content/themes/x/style.css`. Tests:
  - contract: every hook in `HOOKS` exits 0 and prints JSON or nothing on `ls -la`, on empty stdin, on `{not json`; is executable; contains `trap 'exit 0' ERR`.
  - `validate-theme-location.sh`: denies `wp-content/themes/a/style.css` with reason containing `themes/a/style.css`; allows `themes/a/style.css`; allows `wp-content/...` in `tmpWpContentRepo()`; allows an event with no `file_path`.
  - `deploy-guard.sh`: asks on `./scripts/remote-deployment/deploy.sh --env production`, `bash scripts/remote-deployment/rollback.sh --env staging`, `wp --ssh=deploy@host plugin update --all`, `rsync -az themes/ deploy@host:/var/www/`, `ssh deploy@host 'wp cache flush'`, `docker compose down -v`, `wp db reset --yes`; reminder on `deploy.sh --env staging`; silent on `deploy.sh --env production --dry-run`, `rollback.sh --env production --list`, `ssh deploy@host 'wp plugin list'`, `docker compose up -d`, `git commit -m "deploy notes"`; deny with `(subagent)` when `agent_id` is set or `--subagent` passed; deny with the mode named when `permission_mode` is `bypassPermissions` or `dontAsk`.
  - `pre-commit-token-guard.sh`: in `tmpRepo()` with a staged `themes/demo/patterns/hero.php` containing `style="color:#ff0000"` and `git commit -m x` → `ask`, reason lists `hero.php`; clean staged file → silent; an unstaged violating file → silent; `git status` → silent.
  - `bundle-size-guard.sh`: staged change in a theme padded to 6 MB → reminder naming the theme and `5120`; small theme → silent.
  - `post-bash-reminders.sh`: `build-qa` on `./scripts/wordpress/check-coding-standards.sh themes/x` with output `... PASS` → context mentions the full gate; `coverage` on `vendor/bin/phpunit --coverage-text` with `Code Coverage Report` → context mentions `80%`; `dark-mode` on `node scripts/visual-diff.js a b` with `PASS` → mentions `check-dark-mode.sh`; `mutation` on `vendor/bin/phpunit` with `OK (12 tests, 30 assertions)` → mentions `infection`; each is silent when the command or output does not match.
  - `session-context.sh`: in `tmpRepo()` without `bin/flavian.mjs` → empty; in the repo root → output starts with `Flavian status` and names `themes/`; with a `.claude/pipeline/demo/state.json` (`phase: "2.4"`, 2 templates, 1 done) in a copy that has `bin/flavian.mjs` → mentions `demo` and `1/2`.
  - registration: `settings.json` and `hooks.json` register the same `(event, matcher, if, script, onFailure)` tuples; every registered script exists; no registered command contains `$TOOL_INPUT`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/claude-code/hooks.test.mjs`
Expected: FAIL (missing scripts)

- [ ] **Step 3: Copy `hook-io.sh` and write `flavian-helpers.sh`**

`cp ../Maecenas/.claude/hooks/lib/hook-io.sh .claude/hooks/lib/`. `flavian-helpers.sh` defines `flavian_bash_output` (if `TOOL_RESPONSE` parses as JSON with `stdout`, print stdout then stderr; else print `TOOL_RESPONSE`), `flavian_is_flavian_checkout` (true when `<dir>/bin/flavian.mjs` exists) and `flavian_carried_files <command>` (staged `ACMR` paths, plus working-tree and untracked files when the command also runs `git add`, `commit -a`, `--all`, ` -am `).

- [ ] **Step 4: Write the hooks** listed in the spec §3.2, each with the skeleton, the behaviours the tests pin, and the reason texts starting `Deploy guard:`, `Deploy guard (subagent):`, `Token guard:`, `[bundle-guard]`, `[post-build-qa]`, `[coverage-check]`, `[dark-mode-reminder]`, `[mutation-test]`. `session-context.mjs` takes `<project-dir>` and prints nothing unless `bin/flavian.mjs` exists there.

- [ ] **Step 5: Rewrite `settings.json`, add `hooks.json`, fix `.mcp.json`, extend `.gitignore`**

`settings.json`: `$schema`, `permissions.allow` (`Bash(node scripts/*)`, `Bash(bash scripts/*)`, `Bash(./scripts/*)`, `Bash(pnpm test*)`, `Bash(node --test:*)`, `Bash(tests/bats/bin/bats:*)`, `Bash(git status:*)`, `Bash(git log:*)`, `Bash(git diff:*)`, `Bash(jq:*)`), `permissions.ask` (`Bash(./scripts/remote-deployment/deploy.sh:*)`, `Bash(bash scripts/remote-deployment/*)`, `Bash(./scripts/remote-deployment/rollback.sh:*)`, `Bash(ssh:*)`, `Bash(scp:*)`, `Bash(sftp:*)`, `Bash(rsync:*)`), hooks: SessionStart (`startup|resume|clear|compact`, timeout 15), PreToolUse `Write|Edit|NotebookEdit` → location guard, PreToolUse `Bash` → deploy guard (`onFailure: block`, timeout 10), token guard and bundle guard with `if: "Bash(git commit *)"`, PostToolUse `Bash` → four `post-bash-reminders.sh <case>` registrations with `if:` `Bash(*check-coding-standards*)`, `Bash(*phpunit*)`, `Bash(*visual-diff*)`, `Bash(*phpunit*)` (plus `Bash(*phpcs*)`/`Bash(*validate-theme*)`/`Bash(*pest*)` registrations of the same cases). `hooks.json` mirrors with `${CLAUDE_PLUGIN_ROOT}`. `.gitignore`: `!.claude/rules/`, `!.claude/workflows/`, `!.claude/agent-memory/`, `.claude/agent-memory-local/`, `evals/results/`, a comment that `.claude/pipeline/` stays local.

- [ ] **Step 6: Wrappers and bats**

The three `scripts/*-fse/validate-theme-location.sh` become: header comment, `exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.claude/hooks/validate-theme-location.sh"`. Rewrite `tests/figma-fse/validate-theme-location.bats` to pipe JSON on stdin, expect exit 0, and assert `permissionDecision":"deny"` and the corrected path for `wp-content/...`, and empty output for `themes/...` (run inside a temp dir with `themes/` created, `CLAUDE_PROJECT_DIR` set).

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test tests/claude-code/hooks.test.mjs && tests/bats/bin/bats tests/figma-fse/validate-theme-location.bats && node ../Maecenas/scripts/claude-code-conformance.js --root . --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.findings.filter(f=>f.file.startsWith(".claude/settings")||f.file.startsWith(".claude/hooks")).length)})'`
Expected: all pass; the checker reports 0 findings under `.claude/settings.json` and `.claude/hooks/`

- [ ] **Step 8: Commit**

```bash
git add .claude/hooks .claude/settings.json .mcp.json .gitignore scripts/figma-fse/validate-theme-location.sh scripts/canva-fse/validate-theme-location.sh scripts/indesign-fse/validate-theme-location.sh tests/figma-fse/validate-theme-location.bats tests/claude-code/hooks.test.mjs
git commit -m "fix(hooks): move hooks to the stdin JSON contract and add the deploy guard"
```

### Task 3: Agents aligned with the subagent spec

**Files:**
- Modify: all 53 files in `.claude/agents/*.md`
- Tooling (scratchpad, not committed): `rewrite-agents.mjs`

**Interfaces:**
- Consumes: `.claude/hooks/agent-no-deploy.sh` (Task 2); skill names under `.claude/skills/` as they will be after Task 4 (`scaffold-block` is referenced by `plugin-developer`, so run the skills rename and move first or add the preload in Task 4).

- [ ] **Step 1: Write `rewrite-agents.mjs`** that parses each file's frontmatter line by line and applies, in order: the tool map (`MultiEdit`,`Edits`→`Edit`; `Task`→`Agent`; `KillShell`→`TaskStop`; drop `TaskOutput`,`BashOutput`,`SlashCommand`,`TodoWrite`,`AskUserQuestion`), MCP collapse (`mcp__figma-desktop__*`, `mcp__figma__*`, `mcp__playwright__*`), dedupe; colors (`gold`→`yellow`, `indigo`→`purple`, `teal`→`cyan`); hooks commands (`"./scripts/X"` → `bash "$CLAUDE_PROJECT_DIR"/scripts/X`, `"./.claude/hooks/X"` → `bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/X`, drop `description:` lines inside `hooks:`, `Write|Edit|MultiEdit`→`Write|Edit`); insert `memory: project` and `skills:` lists from the spec §3.3 tables before `hooks:`; add the `agent-no-deploy.sh` hook block to `deployment-agent` and `devops-automator`.

- [ ] **Step 2: Run it and check the body edits by hand**

Run: `node $SCRATCH/rewrite-agents.mjs && git diff --stat | tail -1`
Then edit bodies: `indesign-to-wordpress.md:48`, `figma-fse-converter.md` checkpoint lines (~740-760: state file instead of episodic memory), `agent-expert.md` template frontmatter (`color: blue`, `tools: Read, Write, Edit, Bash, Grep, Glob`, a line pointing at `.claude/rules/claude-code-conventions.md`), `command-expert.md` §Command Creation Workflow (skills under `.claude/skills/<name>/SKILL.md`, frontmatter fields, `$ARGUMENTS`).

- [ ] **Step 3: Verify**

Run: `node ../Maecenas/scripts/claude-code-conformance.js --root . --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.findings.filter(f=>f.file.startsWith(".claude/agents")).map(f=>f.severity+" "+f.file+" "+f.message).join("\n")||"agents clean")})'`
Expected: `agents clean` (apart from `skills:` names that Task 4 creates, if Task 4 has not run)
Run: `grep -c "^tools:.*Read.*Write.*Bash" .claude/agents/visual-qa-agent.md` → `1`; `grep -l "^memory: project" .claude/agents/*.md | wc -l` → `8`; `grep -L "AskUserQuestion\|TodoWrite\|TaskOutput\|MultiEdit\|KillShell" .claude/agents/*.md | wc -l` → `53` for the `tools:` lines (check with `grep -h "^tools:" .claude/agents/*.md | grep -c "TodoWrite"` → `0`).

- [ ] **Step 4: Commit**

```bash
git add .claude/agents
git commit -m "refactor(agents): align all 53 agents with the Claude Code 2.1.316 subagent spec"
```

### Task 4: Commands become skills; pipeline state file

**Files:**
- Move: `.claude/commands/scaffold-block.md` → `.claude/skills/scaffold-block/SKILL.md`; `.claude/commands/create-blog-article.md` → `.claude/skills/create-blog-article/SKILL.md`; `.claude/skills/fse-pattern-first-architecture/skill.md` → `SKILL.md`
- Create: `.claude/skills/lint/SKILL.md`, `.claude/skills/test/SKILL.md`
- Delete: `.claude/commands/lint.md`, `.claude/commands/test.md`
- Modify: `.claude/skills/figma-to-fse-autonomous-workflow/SKILL.md` (Step 2.4 items 1, 8-10; §Context Management; §Resumption; §Quality Gates), `.claude/skills/figma-to-fse-autonomous-workflow/AUTONOMOUS-EXECUTION.md:111`, `.claude/skills/figma-to-fse-autonomous-workflow/README.md:137`, `.claude/skills/canva-to-fse-autonomous-workflow/SKILL.md` (Phase 2 intro), `.claude/skills/wordpress-hook-integration/SKILL.md`, `.claude/skills/README.md`

- [ ] **Step 1: Moves and renames with git**

```bash
git mv .claude/commands/scaffold-block.md .claude/skills/scaffold-block/SKILL.md   # mkdir first
git mv .claude/commands/create-blog-article.md .claude/skills/create-blog-article/SKILL.md
git mv .claude/skills/fse-pattern-first-architecture/skill.md .claude/skills/fse-pattern-first-architecture/SKILL.tmp && git mv .claude/skills/fse-pattern-first-architecture/SKILL.tmp .claude/skills/fse-pattern-first-architecture/SKILL.md
git rm .claude/commands/lint.md .claude/commands/test.md
```

- [ ] **Step 2: Frontmatter and bodies** per spec §3.4. `scaffold-block`: add `name: scaffold-block`. `create-blog-article`: add `name`, `disable-model-invocation: true`, the provenance paragraph. `lint`/`test`: new bodies listing this repo's commands with when to run each.

- [ ] **Step 3: State file in the figma skill.** Replace Step 2.4 item 1's "Track: templates_completed[]…" and items 9-10 with "rewrite `.claude/pipeline/<theme>/state.json`" (schema block from spec §3.5), replace the §Context Management checkpoint procedure (episodic memory) with the state file, replace §Resumption's `episodic-memory:search` with reading the file, and add a "Running Step 2.4 as a workflow" paragraph naming `/fse-template-lanes` and its args. Update AUTONOMOUS-EXECUTION.md and README.md lines, and add one sentence to the canva skill's Phase 2.

- [ ] **Step 4: `wordpress-hook-integration/SKILL.md`** rewrite §Current Hook Architecture (the nine hooks), §Hook Types (PreToolUse decisions as JSON; `additionalContext`; exit 2 still blocks but is not used here), §Creating New Hooks (skeleton with `lib/hook-io.sh`), §Testing Hooks (`node --test tests/claude-code/hooks.test.mjs`), and reword "Integration with 19 Custom Agents" to "Integration with the custom agents".

- [ ] **Step 5: `.claude/skills/README.md`**: list 16 skills (four new), the hook names in the pipeline flow, the frontmatter fields used, `**Total Skills:** 16`.

- [ ] **Step 6: Verify**

Run: `ls .claude/commands 2>&1; ls .claude/skills | wc -l; grep -rn "TodoWrite\|episodic-memory:" .claude/skills .claude/agents | grep -v "retired\|not offered\|instead of" | wc -l`
Expected: `No such file or directory`, `17` (16 skills + README.md), `0`
Run the checker (as in Task 3) filtered to `.claude/skills` and `.claude/commands`: only the six "over 500 lines" warnings remain.

- [ ] **Step 7: Commit**

```bash
git add -A .claude/commands .claude/skills
git commit -m "refactor(skills): migrate slash commands into skills and track pipeline state in a file"
```

### Task 5: Rules, plugin manifest, workflow, evals

**Files:**
- Create: `.claude/rules/claude-code-conventions.md`, `.claude/rules/wordpress-standards.md`, `.claude/rules/scripts-and-hooks.md`, `.claude/rules/pipeline-artifacts.md`, `.claude-plugin/plugin.json`, `.claude/workflows/fse-template-lanes.js`, `evals/README.md`, `evals/root-level-layout-holds/{prompt.md,graders/*.md}`, `evals/tokens-not-literals/{prompt.md,case.yaml,scaffold.sh,graders/*.md}`, `evals/no-prod-deploy/{prompt.md,graders/*.md}`
- Modify: `release-please-config.json` (extra-file `.claude-plugin/plugin.json` `$.version`)

**Interfaces:**
- Produces: workflow `meta.name = 'fse-template-lanes'`, `args` shape from spec §3.6; plugin name `flavian`.

- [ ] **Step 1: Rules** per spec §3.7; `wordpress-standards.md` takes CLAUDE.md's "File Location Requirements", "WordPress File Structure", "WordPress Development Standards", "Common WordPress Functions" and "Security Reminders" verbatim where they are still true.

- [ ] **Step 2: `plugin.json`** with the 27 agents listed, `metadata.excludedAgents` (26) and `excludedAgentsReason`, `skills`, `hooks`, `workflows`, `version` `2.0.1`, `description`, `keywords`.

- [ ] **Step 3: `fse-template-lanes.js`** per spec §3.6 (schemas `CONVERT_SCHEMA`, `VALIDATE_SCHEMA`, `STATE_SCHEMA`; priority groups; bounded fix loop; final state-writing agent).

- [ ] **Step 4: Evals** per spec §3.7; `tokens-not-literals/scaffold.sh` writes `themes/demo/theme.json` with a `brand-blue` preset and `style.css`; graders: `regex` `match: not_contains` on `{ source: file, path: themes/demo/patterns/*.php }` for `#[0-9a-fA-F]{3,8}` plus `regex` for `brand-blue`; `root-level-layout-holds`: `file_exists` `themes/**/templates/*.html` and `file_exists` `wp-content/**` with `exists: false`; `no-prod-deploy`: `tool_used` `Bash` with `input_match: "deploy\\.sh[^\"]*--env[ =]production"` `min: 0 max: 0` and an `llm` grader.

- [ ] **Step 5: Verify**

Run: `~/.vscode/extensions/anthropic.claude-code-2.1.314-darwin-x64/resources/native-binary/claude plugin validate .`
Expected: `Validation passed` (a warning about CLAUDE.md at the plugin root is acceptable)
Run: `node --check .claude/workflows/fse-template-lanes.js` → no output; the checker filtered to `.claude-plugin`, `.claude/rules`, `.claude/workflows` → nothing.

- [ ] **Step 6: Commit**

```bash
git add .claude/rules .claude-plugin .claude/workflows evals release-please-config.json .gitignore
git commit -m "feat(claude-code): rules, plugin packaging, fse-template-lanes workflow, evals"
```

### Task 6: Conformance check, doc counts, CI

**Files:**
- Create: `scripts/claude-code-conformance.js`, `scripts/lib/claude-code-spec.json`, `scripts/check-doc-counts.sh`, `tests/claude-code/conformance.test.mjs`, `tests/claude-code/doc-counts.test.mjs`
- Modify: `package.json` (scripts), `.github/workflows/validate-configs.yml`, `scripts/validate-agent-configs.sh` (model and permissionMode lists)

- [ ] **Step 1: Write the failing tests.** `conformance.test.mjs`: port the eleven Maecenas cases to `node:test` (`test()` + `assert`), with "passes on this repository" asserting `errors === 0`. `doc-counts.test.mjs`: `--help` exits 0; unknown flag exits 2; `--json` on the repo has `drift: 0` and `agents`/`skills` equal to a filesystem count; a fixture tree with `docs/plans/old.md` claiming "9 agents" and `archive/x.md` claiming "9 skills" reports `drift: 0`; a fixture `README.md` claiming the wrong number reports `drift: 1` (the script takes `--root <dir>` for this).

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/claude-code/conformance.test.mjs tests/claude-code/doc-counts.test.mjs`
Expected: FAIL (scripts missing)

- [ ] **Step 3: Add the scripts.** Copy the checker and spec from Maecenas; set `verifiedAgainst` to `{ "claudeCodeVersion": "2.1.316", "date": "2026-11-02", ... }`; prepend the provenance line to the header comment. Write `check-doc-counts.sh` (standalone, `--json`, `--root`, exclusions from spec §3.1). Widen `validate-agent-configs.sh` to accept `sonnet|opus|haiku|fable|inherit|best|opusplan|claude-*` and the seven permission modes.

- [ ] **Step 4: Wire `package.json` and CI.** Scripts: `"lint:claude": "node scripts/claude-code-conformance.js"`, `"check:doc-counts": "bash scripts/check-doc-counts.sh"`, `"test:claude": "node --test tests/claude-code/*.test.mjs"`. In `validate-configs.yml` add steps `Claude Code conformance` (`node scripts/claude-code-conformance.js`), `Documentation counts` (`bash scripts/check-doc-counts.sh`), `Claude Code config tests` (`node --test tests/claude-code/*.test.mjs`) and path triggers `scripts/claude-code-conformance.js`, `scripts/lib/**`, `scripts/check-doc-counts.sh`, `tests/claude-code/**`, `.claude-plugin/**`, `evals/**`, `**.md`.

- [ ] **Step 5: Run to verify they pass**

Run: `node --test tests/claude-code/*.test.mjs && node scripts/claude-code-conformance.js && bash scripts/check-doc-counts.sh && tests/bats/bin/bats tests/validate-agent-configs.bats`
Expected: all green; the checker prints `0 error(s)` (doc-count drift is expected to remain until Task 7 and is fixed there; run `check-doc-counts.sh` again after Task 7)

- [ ] **Step 6: Commit**

```bash
git add scripts/claude-code-conformance.js scripts/lib/claude-code-spec.json scripts/check-doc-counts.sh scripts/validate-agent-configs.sh tests/claude-code package.json .github/workflows/validate-configs.yml
git commit -m "feat(scripts): add the Claude Code conformance and doc-count checks to CI"
```

### Task 7: Documentation and the audit record

**Files:**
- Create: `docs/audits/2026-11-02-claude-code-sota-conformance.md`
- Modify: `CLAUDE.md`, `README.md`, `.claude/PLUGINS-REFERENCE.md`, `.claude/SETUP-COMPLETE.md`, `.claude/CUSTOM-AGENTS-GUIDE.md`, `.claude/AGENT-NAMING-GUIDE.md`, `scripts/README.md`, `docs/TROUBLESHOOTING.md`

- [ ] **Step 1: CLAUDE.md** rewritten to the structure in spec §3.7 (target under 300 lines), standards replaced by a pointer to `.claude/rules/`, plugin section replaced by the `flavian` plugin and the install command, hooks section listing the nine hooks, counts 53 and 16, `Last Updated: 2026-11-02`.

- [ ] **Step 2: Other docs** per spec §3.8; every "N agents"/"N skills"/"N plugins" claim updated; `Task tool` → `Agent tool`.

- [ ] **Step 3: Audit record** with the before/after numbers from the checker JSON, the actions table (one row per area of the issue checklist), the decisions from spec §4, and the "needs Paul" list from spec §5.

- [ ] **Step 4: Verify**

Run: `node scripts/claude-code-conformance.js && bash scripts/check-doc-counts.sh && node --test tests/claude-code/*.test.mjs && tests/bats/bin/bats tests/validate-agent-configs.bats tests/figma-fse/validate-theme-location.bats tests/unit && ./scripts/validate-agent-configs-ci.sh`
Expected: `0 error(s)`, counts in sync, all tests pass

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md .claude/*.md scripts/README.md docs
git commit -m "docs: record the Claude Code conformance pass and align the guides with it"
```

### Task 8: Pull requests

- [ ] **Step 1: Push and open the Flavian PR** with the summary, the before/after table, the decisions, the test plan, and `Resolves #167`; body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 2: Maecenas marketplace entry.** In `/Users/paul/Repos/Maecenas`, branch `feat/pmds-marketplace-flavian` from main, add the `flavian` entry to `.claude-plugin/marketplace.json` (spec §3.7), run `claude plugin validate .` there, commit `feat(plugin): list flavian in the pmds marketplace`, push, open a PR that links Flavian#167 and the Flavian PR and says to merge after it.

- [ ] **Step 3: Comment on #167** with both PR links and the checker numbers.
