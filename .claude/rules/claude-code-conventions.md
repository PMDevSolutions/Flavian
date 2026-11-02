---
paths:
  - ".claude/agents/**"
  - ".claude/skills/**"
  - ".claude/hooks/**"
  - ".claude/rules/**"
  - ".claude/workflows/**"
  - ".claude/settings.json"
  - ".claude-plugin/**"
  - "evals/**"
---

# Claude Code conventions for this repo (verified against Claude Code 2.1.316, 2026-11-02)

Run `node scripts/claude-code-conformance.js` after editing anything under `.claude/`. It fails on retired tool names, unknown frontmatter fields, legacy command files, hooks that reference missing scripts or still expect `$TOOL_INPUT`, and plugin-manifest drift. CI runs it in `.github/workflows/validate-configs.yml`; `tests/claude-code/` covers the hooks, the checker and the doc-count check. The record of the 2026-11-02 pass is `docs/audits/2026-11-02-claude-code-sota-conformance.md`.

## Agents (`.claude/agents/<name>.md`)
- Required: `name` (matches the filename), `description` (when to delegate, with keywords). Used here: `tools`, `model`, `permissionMode`, `color`, `memory`, `skills`, `hooks`.
- Tool names that exist: `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `WebSearch`, `WebFetch`, `Skill`, `Agent`, `NotebookEdit`, `LSP`, `Monitor`, `TaskStop`, `SendMessage`, `Artifact`, `ToolSearch`, `EnterWorktree`/`ExitWorktree`, plus MCP patterns such as `mcp__figma__*`.
- Retired, never use: `MultiEdit` and `Edits` (use `Edit`), `Task` (use `Agent`), `KillShell` (use `TaskStop`), `TaskOutput`, `BashOutput`, `SlashCommand`. `TodoWrite` is not offered on Opus 4.8+, Sonnet 5+ or Fable: pipelines track progress in a state file.
- `AskUserQuestion` is never available inside a subagent. Agents return open questions in their final report.
- A `tools:` list excludes MCP tools unless an `mcp__<server>__*` pattern is listed. The Figma converter and the visual QA agent list `mcp__figma-desktop__*, mcp__figma__*`; the browser-driven auditors list `mcp__playwright__*`.
- `memory: project` writes to `.claude/agent-memory/<name>/` (committed; `agent-memory-local/` is ignored). Eight agents use it because their knowledge compounds across conversions and audits: the three converters, `visual-qa-agent`, `asset-cataloger`, `performance-benchmarker`, `security-audit-agent`, `wp-environment-manager`.
- `color` accepts only red, blue, green, yellow, purple, orange, pink, cyan.
- Agent-scoped hooks reference their scripts as `bash "$CLAUDE_PROJECT_DIR"/scripts/<agent>/<script>.sh` or `.../.claude/hooks/<name>.sh`, on the stdin JSON contract. Plugin agents ignore `hooks`, `mcpServers` and `permissionMode`, so every rule that must hold in a plugin install is also a settings-level hook (`deploy-guard.sh` denies deploys in any subagent by reading `agent_id`). `deployment-agent` and `devops-automator` carry `agent-no-deploy.sh` in their frontmatter.
- 28 of the 53 agents still pin `model: opus` and `permissionMode: bypassPermissions`, a choice from before this pass that the audit record lists for review. In those agents a hook's `ask` becomes `deny`.
- The plugin ships 27 of the 53 agents; `.claude-plugin/plugin.json` → `metadata.excludedAgents` lists the other 26 with the reason. A new agent goes in one list or the other, and the conformance check enforces it.

## Skills (`.claude/skills/<name>/SKILL.md`)
- Custom slash commands are skills; `.claude/commands/` is retired here. The file is `SKILL.md`, uppercase (Linux is case-sensitive).
- Fields used: `name`, `description` (with trigger keywords), `argument-hint`, `allowed-tools` (pre-approval, not restriction), `disable-model-invocation` (`create-blog-article`), `paths`. A research skill that should run inside a specialist uses `context: fork` + `agent:` + `background: false`.
- `globs:` is not a field. Keep `SKILL.md` under 500 lines; six skills are over and give up reference material to sibling files when next touched.
- Pipeline skills track progress in `.claude/pipeline/<theme>/state.json` (schema in `figma-to-fse-autonomous-workflow/SKILL.md` → Progress Tracking) and never in TodoWrite or episodic memory. Step 2.4 of the figma pipeline runs through the `fse-template-lanes` workflow when there are three or more templates.

## Hooks (`.claude/hooks/*.sh`, registered in `.claude/settings.json`)
- Input is the event JSON on stdin; output is JSON on stdout (plain text for SessionStart). `$TOOL_INPUT`, `$TOOL_OUTPUT` and `CLAUDE_TOOL_INPUT` are not part of the contract. Source `lib/hook-io.sh` (and `lib/flavian-helpers.sh`) and call `hook_read_input`, then `hook_read_context`.
- Every hook keeps the defensive skeleton (`set -u`, `trap 'exit 0' ERR`, `|| true` on anything that may fail inside `$( )`, always exit 0) and has a test in `tests/claude-code/hooks.test.mjs`.
- Blocking decisions are `permissionDecision: deny` or `ask` in a PreToolUse hook; `hook_gate_decision` turns an `ask` into a `deny` where a hook cannot prompt (`bypassPermissions`, `dontAsk`). Reminders are `additionalContext`.
- Reference scripts as `bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/<name>.sh` (quoted; works from worktrees and cloud sessions). `.claude/hooks/hooks.json` mirrors the same hooks with `${CLAUDE_PLUGIN_ROOT}` for plugin installs; the registration test fails if they drift.
- `deploy-guard.sh` is registered with `onFailure: "block"` (a guard that cannot start blocks the call). Reminders keep the default. A hook that should only start for some commands gets an `if:` filter (one permission rule each); the same script is registered once per rule with an argument (`post-bash-reminders.sh <case>`).
- Hooks that the plugin carries into other repos scope themselves: `validate-theme-location.sh` enforces only where a root `themes/` exists and nothing is tracked under `wp-content/`; `session-context.sh` is silent without `bin/flavian.mjs`.
- Every event carries `agent_id` and `agent_type` when it fires inside a subagent; the deploy guard keys subagent mode on `agent_id`.

## Settings (`.claude/settings.json`, `.mcp.json`)
- `settings.json` is tracked and holds the hooks and `$schema`. `settings.local.json` is gitignored and personal. Permission rules are the human's to add (allow rules for the repo's scripts and tests, ask rules for `ssh`, `scp`, `rsync` and the deploy scripts); an agent session does not grant itself rules.
- `.mcp.json` lists `figma-desktop`, `figma` and `playwright` (started with `npx`, not `cmd /c`).

## Workflows (`.claude/workflows/`)
- `fse-template-lanes.js` is called by the pipeline skills by name through the Workflow tool: one lane per template, the fix-loop bound enforced in code, the `templates` section of the state file written at the end. Workflow scripts are plain JavaScript: no `import`, no `Date.now()` or `Math.random()` (pass timestamps through `args`), `export const meta` first.

## Plugin packaging (`.claude-plugin/`)
- `plugin.json` points at the live `.claude/agents` files, `.claude/skills`, `.claude/hooks/hooks.json` and `.claude/workflows`, so the repo is both a project and an installable plugin with one source of truth. Validate with `claude plugin validate .`. `version` follows `package.json` through release-please's extra-files.
- Install elsewhere: `claude plugin marketplace add PMDevSolutions/Maecenas` (the `pmds` marketplace) then `claude plugin install flavian@pmds --scope project`. The pipeline skills call `./scripts/...` and need a Flavian checkout; the agents, knowledge skills, hooks and the workflow work in any repo.
- `evals/` holds one case per hard rule (root-level layout, tokens not literals, no production deploy). `claude plugin eval . --scaffold --allow-tools Write Edit Bash` runs them by hand; they cost model calls.

## Counts
- 53 agents, 16 skills. Adding or removing one changes the documented counts; `bash scripts/check-doc-counts.sh` fails CI on drift (historical records under `docs/plans/`, `docs/audits/` and `archive/` are excluded).
