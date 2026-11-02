# Claude Code SOTA conformance for Flavian: design

**Date:** 2026-11-02 · **Issue:** [#167](https://github.com/PMDevSolutions/Flavian/issues/167) · **Reference implementation:** Maecenas commits b371dbe..6d6f1fe and its [audit record](https://github.com/PMDevSolutions/Maecenas/blob/main/docs/audits/2026-10-03-claude-code-sota-audit.md); Aurelius (6384948..8e12e84) and RCVMD (#12) applied the same pass to a coding framework and a WordPress site repo, and this design borrows their shapes where Flavian's needs match.

## 1. Problem

Flavian's Claude Code configuration was written against the Claude Code of early 2026. Run against the current spec (Claude Code 2.1.316, docs fetched 2026-11-02), `claude-code-conformance.js` reports **53 agents, 12 skills, 139 errors, 56 warnings**:

| Defect | Count | Effect today |
|--------|-------|--------------|
| Retired tool names in agent `tools:` (`MultiEdit`, `Task`, `TaskOutput`, `KillShell`, `Edits`) | 100 errors | Each name is dropped silently; agents that meant `Edit` or `Agent` lose the tool |
| `AskUserQuestion` in agent `tools:` | 25 errors | Never available in a subagent; agents written to "ask the user" stall or guess |
| `TodoWrite` in agent `tools:` | 32 warnings | Not offered on Opus 4.8+, Sonnet 5+, Fable; progress tracking written around it does nothing |
| Six inline `PostToolUse` hooks in `settings.json` reading `$TOOL_INPUT` / `$TOOL_OUTPUT` | 10 errors | Those variables are not part of the hook contract. None of the six hooks (quality-gate reminder, pre-commit color guard, bundle guard, coverage, dark-mode, mutation reminders) has ever fired |
| Three agent-scoped `validate-theme-location.sh` copies under `scripts/*-fse/` reading `CLAUDE_TOOL_INPUT` and using `grep -P` | not counted by the checker | Dead on the stdin contract and on macOS grep; the three converter agents' location guard never fires |
| Four legacy `.claude/commands/*.md` | 4 warnings | Two are Python lint/test commands copied from another template; one targets a `cli-tool/` tree that does not exist here |
| Invalid `color` values (`gold`, `indigo`, `teal`) | 4 errors | Ignored |
| `fse-pattern-first-architecture/skill.md` (lowercase) | invisible on macOS | Claude Code looks for `SKILL.md`; the skill is missing on Linux (CI, cloud sessions, plugin installs) |
| `.mcp.json` playwright entry launched with `cmd /c` | not counted | Fails on macOS and Linux every session (`ENOENT: cmd`) |
| Docs claim 6 installed plugins, `/commit` shortcuts, TodoWrite progress, episodic-memory checkpoints | | None of it exists on the dev machine or in current Claude Code |

The issue's follow-up comment adds a consumer: RCVMD wants to install Flavian as a plugin and use `accessibility-auditor`, `block-markup-validator`, `theme-token-auditor` and `visual-qa-agent` from it, through `claude plugin install flavian@pmds`.

## 2. Goal and success criteria

Bring Flavian to conformance with Claude Code 2.1.316 the way Maecenas, Aurelius and RCVMD were, and package it as the `flavian` plugin.

Done means:

1. `node scripts/claude-code-conformance.js` reports 0 errors on the repo and runs in CI; the only remaining warnings are the six `SKILL.md` files over 500 lines (out of scope, listed as follow-up).
2. Every hook in `.claude/settings.json` fires on the stdin JSON contract, has a test, and is mirrored in `.claude/hooks/hooks.json` for the plugin build. Guards that protect something are PreToolUse `ask`/`deny`; reminders are `additionalContext`.
3. All 53 agents carry only tools that exist, valid colors, and (where it compounds) `memory: project`, `skills:` preloads, and `mcp__<server>__*` patterns.
4. `.claude/commands/` is gone; the four commands are skills; documented counts (53 agents, 16 skills) match disk and `scripts/check-doc-counts.sh` enforces it.
5. The figma pipeline tracks progress in `.claude/pipeline/<theme>/state.json`, not TodoWrite or episodic memory, and the per-template loop can run as the `fse-template-lanes` workflow.
6. `.claude-plugin/plugin.json` validates with `claude plugin validate .`; `.claude/rules/` carries the path-scoped standards and CLAUDE.md shrinks to orientation; `evals/` holds one case per hard rule.
7. `docs/audits/2026-11-02-claude-code-sota-conformance.md` records the before/after numbers, the decisions below, and what still needs Paul.

Out of scope (recorded as follow-ups in the audit): shortening the six oversized `SKILL.md` files; revisiting `model: opus` and `permissionMode: bypassPermissions` on 28 agents; running `claude plugin eval` (costs model calls); the agent-scoped `scripts/<agent>/*.sh` hook scripts beyond the three dead location guards (they already read stdin).

## 3. Design

### 3.1 Conformance checker and doc counts

`scripts/claude-code-conformance.js` and `scripts/lib/claude-code-spec.json` are copied from Maecenas unchanged except for the header note on provenance and `verifiedAgainst` bumped to `2.1.316` / `2026-11-02`. Verification today: the sub-agents, skills, hooks, plugins-reference, workflows and plugin-evals pages, plus the CHANGELOG entries for 2.1.311 to 2.1.316, add no tool renames, hook events, frontmatter fields or manifest fields beyond what the 2.1.310 spec encodes (new since then and irrelevant to the checker: `permissions.blockWritesOutsideWorkingDirectories`, SessionStart matcher `fork`, `permissionDecision: defer`, `CLAUDE_CODE_SUBAGENT_EFFORT`).

`scripts/check-doc-counts.sh` is a standalone port of Maecenas's (same CLI: `--json`, exit 0/1/2) that counts `.claude/agents/*.md` and `.claude/skills/*/SKILL.md` and fails on any "N agents" / "N skills" claim in live Markdown. Excluded as historical: `CHANGELOG.md`, `docs/plans/`, `docs/audits/`, `archive/`, `.claude/research/`, `node_modules`.

Wiring: `package.json` scripts `lint:claude`, `check:doc-counts`, `test:claude`; `.github/workflows/validate-configs.yml` gains three steps (conformance, doc counts, `node --test tests/claude-code/*.test.mjs`) and path triggers for the new files. Tests live in `tests/claude-code/*.test.mjs` on `node:test` (the repo's existing runner for `tests/init`), ported from Maecenas's vitest cases.

`scripts/validate-agent-configs.sh` stays (its bats suite is wired in CI) but its `model` and `permissionMode` allow-lists widen to the spec's values so the two validators cannot contradict each other.

### 3.2 Hooks

All hooks move to the contract: event JSON on stdin, JSON on stdout, `set -u`, `trap 'exit 0' ERR`, always exit 0, sourced `lib/hook-io.sh` (copied verbatim from Maecenas). Commands are registered as `bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/<name>.sh` in `settings.json` and `bash "${CLAUDE_PLUGIN_ROOT}/.claude/hooks/<name>.sh"` in `hooks.json`; a test asserts the two files register the same hooks.

| Hook | Event | Behaviour |
|------|-------|-----------|
| `validate-theme-location.sh` (rewritten) | PreToolUse `Write\|Edit\|NotebookEdit` | `permissionDecision: deny` with the corrected root-level path when `file_path` matches `wp-content/(themes\|plugins\|mu-plugins)/`. **Scoped**: enforces only in a repo with the Flavian layout (a root `themes/` directory and no tracked `wp-content/`), so the plugin's copy stays silent in RCVMD, whose theme lives under `wp-content/themes/`. |
| `deploy-guard.sh` (new) | PreToolUse `Bash`, `onFailure: block` | The money-gate analogue. `ask` on: `scripts/remote-deployment/deploy.sh ... --env production` without `--dry-run`; `rollback.sh` for any env without `--list`; `wp` with `--ssh=`; `ssh`/`sftp` to any host unless the remote command is read-only; `rsync`/`scp` whose destination is remote; local data destroyers (`docker compose down -v`/`--volumes`, `docker volume rm\|prune`, `docker system prune`, `wp db reset\|drop\|clean`, `wp site empty`). `additionalContext` reminder on a non-production `deploy.sh` run. Inside a subagent (`agent_id` present, or `--subagent`), every gated tier is `deny`. In `bypassPermissions`/`dontAsk`, `ask` becomes `deny` with the reason (`hook_gate_decision`). Grep-based like RCVMD's; a keyword pre-check keeps ordinary commands cheap. |
| `agent-no-deploy.sh` (new) | agent frontmatter PreToolUse `Bash` | `exec`s `deploy-guard.sh --subagent`; attached to `deployment-agent` and `devops-automator`. |
| `pre-commit-token-guard.sh` (new) | PreToolUse `Bash`, `if: "Bash(git commit *)"` | Upgrades the never-fired `pre-commit-guard`. Reads the files the commit carries (staged; plus working tree for `-a`/`git add` in the same command), keeps those under `(^\|/)themes/<x>/(templates\|parts\|patterns)/` with `.html`/`.php`, and runs the five `audit-tokens.sh` checks in POSIX ERE (hex in `style=""`, hex in block JSON outside `"border"`, px padding/margin/gap, px font-size, font-family). Findings → `ask` through `hook_gate_decision` with up to 12 lines and the fix. `ask` rather than `deny` because pattern files legitimately carry inline SVG fills; the human decides. |
| `bundle-size-guard.sh` (new) | PreToolUse `Bash`, `if: "Bash(git commit *)"` | For each `themes/<x>` or `plugins/<x>` directory with staged changes, `du -sk`; above 5120 KB (theme) or 10240 KB (plugin) → `additionalContext` reminder (same thresholds as before; a reminder, as it was). |
| `post-bash-reminders.sh <case>` (new) | PostToolUse `Bash`, four registrations with `if:` filters | Replaces the four informational inline hooks: `build-qa` (`validate-theme`/`check-coding-standards`/`phpcs` command whose output reports a pass → run the full gate), `coverage` (`phpunit`/`pest` output with coverage → check the 80% target), `dark-mode` (`visual-diff.js` output with PASS and no FAIL → run `check-dark-mode.sh`), `mutation` (`phpunit`/`pest` all passing → suggest Infection). The argument selects the case so one registration never emits two reminders. Bash `tool_response` is read as a string or as `{stdout, stderr}`. |
| `session-context.sh` + `lib/session-context.mjs` (new) | SessionStart `startup\|resume\|clear\|compact` | Plain-text status: pipeline runs in flight from `.claude/pipeline/*/state.json` (theme, phase, templates done/total, resume hint), themes present under `themes/` (name from `style.css`, theme.json present), Docker stack running or not (`docker ps` with a 3 s timeout), `.env` present, branch and uncommitted files under `themes/`, `plugins/`, `mu-plugins/`, tracked files under `wp-content/` (layout violation), and the active-hooks line. Silent outside a Flavian checkout (no `bin/flavian.mjs`) so the plugin's copy is quiet elsewhere. |
| `figma-fse-post-template.sh`, `figma-fse-completion.sh` (kept) | run by the converter agent through Bash | Gain the defensive skeleton and lose the GNU-only `find -printf`; otherwise unchanged. |

`scripts/figma-fse/validate-theme-location.sh`, `scripts/canva-fse/validate-theme-location.sh` and `scripts/indesign-fse/validate-theme-location.sh` become two-line wrappers that `exec` the project hook with stdin passed through; the agents keep referencing them, and `tests/figma-fse/validate-theme-location.bats` moves to the stdin contract.

`.claude/settings.json` gains `$schema`, `permissions.allow` for the repo's own scripts, tests and read-only git, and `permissions.ask` for the deploy scripts and `ssh`/`scp`/`sftp`/`rsync` (belt and braces next to the hook). `.mcp.json`'s playwright entry becomes `npx @playwright/mcp@latest --headless`.

### 3.3 Agents

A one-off script (kept out of the repo) rewrites the frontmatter of all 53 agents:

- `tools:` — `MultiEdit`/`Edits` → `Edit`, `Task` → `Agent`, `KillShell` → `TaskStop`; `TaskOutput`, `BashOutput`, `SlashCommand`, `TodoWrite`, `AskUserQuestion` dropped; order kept, duplicates removed. Explicit MCP tool lists collapse to server patterns: `mcp__figma-desktop__*`, `mcp__figma__*` (figma-fse-converter, visual-qa-agent), `mcp__playwright__*` (accessibility-auditor, visual-qa-agent, seo-schema-agent).
- `color:` — `gold` → `yellow`, `indigo` → `purple`, `teal` → `cyan`.
- `hooks:` — commands become `bash "$CLAUDE_PROJECT_DIR"/scripts/...` or `.../.claude/hooks/...`; `description` keys (not in the schema) are dropped; `Write|Edit|MultiEdit` matchers become `Write|Edit`.
- `memory: project` on the eight agents whose knowledge compounds across runs: `figma-fse-converter`, `canva-fse-converter`, `indesign-to-wordpress` (per-theme token and component decisions), `visual-qa-agent`, `asset-cataloger`, `performance-benchmarker`, `security-audit-agent`, `wp-environment-manager`. `.claude/agent-memory/` is committed; `.claude/agent-memory-local/` is ignored.
- `skills:` preloads where a skill is the agent's method: converters → their pipeline skill plus `fse-pattern-first-architecture` and `fse-block-theme-development`; `frontend-developer` → `fse-block-theme-development`, `block-pattern-creation`, `fse-pattern-first-architecture`; `ui-designer`, `block-markup-validator`, `theme-token-auditor`, `migration-specialist` → `fse-block-theme-development`; `plugin-developer` → `wordpress-security-hardening`, `wordpress-internationalization`, `scaffold-block`; `test-writer-fixer` → `wordpress-testing-workflows`; `security-audit-agent` → `wordpress-security-hardening`; `visual-qa-agent`, `accessibility-auditor` → `visual-qa-verification`; `wp-environment-manager`, `woocommerce-agent`, `content-seeder` → `wp-cli-workflows`.
- `deployment-agent` and `devops-automator` get the `agent-no-deploy.sh` frontmatter hook.
- Body edits: `indesign-to-wordpress` ("Use TodoWrite to track them" → the state file), `figma-fse-converter` (checkpoint and completion steps), `agent-expert` (templates use valid colors and tool names and point at the conventions rule), `command-expert` (creates skills under `.claude/skills/<name>/SKILL.md`, not `cli-tool/components/commands/`).

`model: opus` and `permissionMode: bypassPermissions` are left as they are (out of scope; the deploy guard's `ask` becomes `deny` in those agents, which is the intended behaviour).

### 3.4 Commands become skills

| Command | Skill | Frontmatter | Body |
|---------|-------|-------------|------|
| `scaffold-block.md` | `scaffold-block/SKILL.md` | `name`, `description`, `argument-hint`, `allowed-tools` | Moved as is |
| `lint.md` | `lint/SKILL.md` | `argument-hint: [path]` | Rewritten for this repo: PHPCS via `check-coding-standards.sh`, security scan, conformance check, commitlint, GUI lint. The Python content never applied here |
| `test.md` | `test/SKILL.md` | `argument-hint: [suite]` | Rewritten for this repo: bats suites, `pnpm test:init`, `test:pipeline`, `test:claude`, GUI tests, PHPUnit |
| `create-blog-article.md` | `create-blog-article/SKILL.md` | `disable-model-invocation: true`, `argument-hint` | Moved as is with a provenance note: imported from claude-code-templates, its paths (`cli-tool/components/`, `docs/blog/`, `scripts/generate_blog_images.py`) do not exist in Flavian; adapt before use |

`fse-pattern-first-architecture/skill.md` is renamed to `SKILL.md`. Skill count becomes 16.

### 3.5 Pipeline state file

`.claude/pipeline/<theme-slug>/state.json` replaces TodoWrite tracking and the episodic-memory checkpoints in the figma pipeline (and is named as the resumability record in the canva skill). It is local to a checkout (`.claude/*` is ignored; same choice as Aurelius's `.claude/plans/pipeline-state.json`). Shape:

```json
{
  "pipeline": "figma-to-fse",
  "theme": "acme",
  "source": { "type": "figma", "url": "https://www.figma.com/design/...", "fileKey": "..." },
  "startedAt": "2026-11-02T10:00:00Z",
  "updatedAt": "2026-11-02T10:42:00Z",
  "phase": "2.4",
  "phases": {
    "1": { "name": "discovery", "status": "done" },
    "2": { "name": "conversion", "status": "running" },
    "3": { "name": "completion", "status": "pending" }
  },
  "designSystem": { "themeJson": "themes/acme/theme.json", "colors": ["primary"], "fontSizes": ["base"], "spacing": ["40"] },
  "templates": [
    { "name": "header.html", "kind": "part", "priority": 1, "status": "done", "attempts": 1, "figmaNodeId": "1:2", "issues": [] },
    { "name": "front-page.html", "kind": "template", "priority": 3, "status": "pending", "attempts": 0, "figmaNodeId": "1:9", "issues": [] }
  ],
  "errors": [ { "template": "index.html", "error": "get_code failed", "resolution": "get_screenshot fallback" } ]
}
```

`status` is one of `pending`, `running`, `done`, `needs-review`, `failed`. The skill rewrites the whole file at every phase boundary and after each template; resumption reads it instead of searching episodic memory; the SessionStart hook reports runs whose `phase` is not `done`.

### 3.6 `fse-template-lanes` workflow

`.claude/workflows/fse-template-lanes.js` is the per-page lane the audit asked for ("Flavian pages"). Called by the figma skill's Step 2.4 when the plan has three or more templates (or directly as `/fse-template-lanes`), with `args = { theme, source, converter, templates: [{ name, kind, priority, figmaNodeId }], maxAttempts, stateFile }`.

- Templates run in priority groups with a barrier between groups (parts before templates that reference them; `index.html` before the rest).
- Each lane: the converter agent generates the file (schema: path, blocks, tokensUsed, inlineStyles, openQuestions) → `block-markup-validator` runs `validate-template.sh`, `validate-block-markup.sh` and `audit-tokens.sh` on it without editing (schema: passed, hardcodedColors, hardcodedPx, unbalancedBlocks, findings) → up to `maxAttempts` fix rounds, the bound enforced in code → status `GREEN`, `NEEDS_REVIEW` or `MISSING`.
- A final agent writes the `templates` section of the state file from the lane results and returns the summary and `nextStep`. No `Date.now()`, `Math.random()` or module loading, per the workflow runtime rules.

### 3.7 Rules, CLAUDE.md, plugin, evals

`.claude/rules/`:
- `claude-code-conventions.md` (paths: `.claude/**`, `.claude-plugin/**`, `evals/**`): Flavian's version of the Maecenas rule, with the hook and state-file conventions above.
- `wordpress-standards.md` (paths: `themes/**`, `plugins/**`, `mu-plugins/**`): the root-level layout rule, theme and plugin structure, PHP standards, escaping and sanitising, nonces and capabilities, `$wpdb->prepare`, enqueueing, the common functions list. Moved out of CLAUDE.md.
- `scripts-and-hooks.md` (paths: `scripts/**`, `.claude/hooks/**`, `tests/**`): bash 3.2 portability (no `grep -P`, `mapfile`, `${var,,}`, GNU `find -printf`), exit codes, where tests live (bats for shell, `node:test` for Node), the hook skeleton.
- `pipeline-artifacts.md` (paths: `.claude/pipeline/**`, `.claude/figma-data/**`, `.claude/reports/**`, `tests/visual/**`): the state file, the attribute-comparison data, report locations.

CLAUDE.md shrinks to orientation: what the repo is, the layout rule, the commands, the Claude Code configuration (agents, skills, hooks, rules, workflow, plugin, evals, conformance check) and the documentation map. Counts: 53 agents, 16 skills, no installed plugins.

`.claude-plugin/plugin.json`: `name: flavian`, version from `package.json` (release-please gets the file as an extra-file), `agents` listed explicitly (the checker enforces the list), `skills: ./.claude/skills`, `hooks: ./.claude/hooks/hooks.json`, `workflows: ./.claude/workflows`. `metadata.excludedAgents` keeps 26 agents in the repo but out of the plugin: 13 whose names the `maecenas` plugin already ships (`agent-expert`, `command-expert`, `content-creator`, `experiment-tracker`, `feedback-synthesizer`, `joker`, `legal-compliance-checker`, `project-shipper`, `reddit-community-builder`, `sprint-prioritizer`, `studio-coach`, `support-responder`, `tiktok-strategist`), because installing both plugins in one repo would otherwise load two agents per name, and 13 with no WordPress or web-engineering job (`ai-engineer`, `analytics-reporter`, `brand-guardian`, `docusaurus-expert`, `finance-tracker`, `growth-hacker`, `instagram-curator`, `studio-producer`, `tool-evaluator`, `trend-researcher`, `twitter-engager`, `visual-storyteller`, `workflow-optimizer`). The 27 shipped agents include the four RCVMD named. The list is reversible by editing the manifest.

The `pmds` marketplace lives in Maecenas (`.claude-plugin/marketplace.json`). `flavian@pmds` therefore needs a `flavian` entry there with `source: { "source": "github", "repo": "PMDevSolutions/Flavian" }`; that is a separate pull request in Maecenas, opened alongside this one. Flavian ships no marketplace of its own, so there is one source of truth for `pmds`.

`evals/`: `root-level-layout-holds` (a request to create a template under `wp-content/themes/` ends with the file under `themes/` and nothing under `wp-content/`), `tokens-not-literals` (a pattern asked for in a named hex colour is written with theme.json presets; `regex` with `match: not_contains` on the file), `no-prod-deploy` (a casual "deploy to production" never runs `deploy.sh --env production`; the reply hands the command back). Mechanical graders first, one `llm` grader per case. Not run here (model calls); the README gives the command.

### 3.8 Documentation

- `docs/audits/2026-11-02-claude-code-sota-conformance.md`: method, before/after table, actions, decisions, what needs Paul.
- `.claude/PLUGINS-REFERENCE.md` rewritten: no plugins are installed on the dev machine (only `typescript-lsp` in the user profile); the repo is itself the `flavian` plugin; how to install it; which official-marketplace plugins fit this work (`php-lsp`, `commit-commands`, `github`, `superpowers`, `playwright`, `figma`, `canva`, `code-review`).
- `.claude/SETUP-COMPLETE.md` reduced to a dated status that points at the audit.
- `README.md`, `.claude/CUSTOM-AGENTS-GUIDE.md`, `.claude/skills/README.md`, `.claude/skills/wordpress-hook-integration/SKILL.md`, `scripts/README.md`, `docs/TROUBLESHOOTING.md`: counts, the Agent tool (not Task), the hook contract, the new skills and hooks.

## 4. Decisions worth recording

1. **`ask`, not `deny`, for the token guard.** Flavian patterns carry inline SVG with `fill="#..."`; the guard lists the findings and lets the human decide. In modes where a hook cannot prompt the answer is `deny`, so an unattended session cannot commit past it.
2. **The location guard scopes itself to the Flavian layout.** The plugin's hooks load in every repo that enables it; RCVMD tracks `wp-content/themes/rcvmd/`, so an unscoped guard would deny its every theme write.
3. **The state file is local, not committed.** It belongs to one checkout, like Aurelius's; the theme it describes is what gets committed.
4. **Excluding agents from the plugin is a manifest choice**, not a deletion: every agent stays in `.claude/agents/`.
5. **`lint` and `test` are rewritten, not moved.** Moving Python tooling instructions into a WordPress repo's skills would make `/lint` run `black` here. `create-blog-article` is moved with a provenance note and `disable-model-invocation: true` because the issue asks for all four commands to become skills; it never worked in this repo and says so at the top.
6. **The checker is copied, not shared.** Each PMDS repo carries its own copy and spec (the issue's instruction), so a repo can be checked without a sibling checkout.

## 5. What needs Paul

- Approve and merge the Maecenas pull request that adds `flavian` to the `pmds` marketplace, then `claude plugin marketplace add PMDevSolutions/Maecenas` and `claude plugin install flavian@pmds --scope project` in RCVMD.
- Decide whether the 28 `model: opus` + `permissionMode: bypassPermissions` pins stay (cost and the hook's deny-in-bypass behaviour).
- Run `claude plugin eval . --scaffold --allow-tools Write Edit Bash` once; it costs model calls.
- The six `SKILL.md` files over 500 lines (figma pipeline at 1243) can move reference material beside them in a later pass.
