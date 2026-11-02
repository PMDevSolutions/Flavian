# Claude Code SOTA conformance: Flavian

**Date:** 2026-11-02 · **Claude Code audited against:** 2.1.316 (docs fetched 2026-11-02; local CLI 2.1.314) · **Issue:** [#167](https://github.com/PMDevSolutions/Flavian/issues/167) · **Design and plan:** `docs/plans/2026-11-02-claude-code-conformance-design.md`, `docs/plans/2026-11-02-claude-code-conformance.md` · **Reference:** the Maecenas pass of 2026-10-03 ([record](https://github.com/PMDevSolutions/Maecenas/blob/main/docs/audits/2026-10-03-claude-code-sota-audit.md)), with the Aurelius and RCVMD passes as the coding-framework and WordPress-repo shapes.

Flavian's Claude Code configuration was written against the Claude Code of early 2026. This pass brought it to the current spec, replaced the hooks that never fired, retired the legacy command files, packaged the repo as the `flavian` plugin, and wired a conformance check into CI so the drift does not come back.

## 1. Method

- `scripts/claude-code-conformance.js` (the Maecenas checker, spec `scripts/lib/claude-code-spec.json`) run read-only against `main` (fca4261) for the baseline, then after every step.
- Spec re-verified against the sub-agents, skills, hooks, plugins-reference, workflows and plugin-evals docs pages and the CHANGELOG entries 2.1.311 to 2.1.316: no tool renames, hook events, frontmatter fields or manifest fields changed since the 2.1.310 spec. New and irrelevant to the checker: `permissions.blockWritesOutsideWorkingDirectories`, the SessionStart matcher `fork`, `permissionDecision: defer`, `CLAUDE_CODE_SUBAGENT_EFFORT`. The spec's `verifiedAgainst` stamp was bumped to 2.1.316.
- Local inventory: every file under `.claude/`, `scripts/`, `tests/`, the docs that carry counts, `.mcp.json`, and the user profile (`installed_plugins.json`: only `typescript-lsp`, for another repo; `known_marketplaces.json`: the official marketplace only).

## 2. Numbers

| | Agents | Skills | Errors | Warnings |
|---|---|---|---|---|
| Before (main, fca4261) | 53 | 12 | 139 | 56 |
| After this pass | 53 | 16 | 0 | 6 |

The six remaining warnings are `SKILL.md` files over 500 lines (`block-pattern-creation` 583, `figma-to-fse-autonomous-workflow` 1163, `fse-block-theme-development` 516, `wordpress-security-hardening` 715, `wordpress-testing-workflows` 821, `wp-cli-workflows` 698). Out of scope here; each gives up reference material to sibling files when next touched.

## 3. Findings and actions

| # | Area | Found | Action |
|---|------|-------|--------|
| 1 | **Agent tool names** | 100 errors: `MultiEdit` ×26, `TaskOutput` ×28, `Task` ×16, `Edits` ×15, `KillShell` ×15; `AskUserQuestion` ×25 (never available in a subagent); `TodoWrite` ×32 (not offered on current models) | All 53 agents rewritten by script: renames applied, retired and unavailable tools dropped, explicit MCP tool lists collapsed to `mcp__<server>__*`; colors `gold`, `indigo`, `teal` normalised; `memory: project` on eight agents whose knowledge compounds; `skills:` preloads on sixteen; `agent-no-deploy.sh` on the two deploy agents; agent-scoped hook commands through `"$CLAUDE_PROJECT_DIR"`; `agent-expert` and `command-expert` teach this repo's layout instead of the claude-code-templates tree |
| 2 | **Hooks that never fired** | Six inline `PostToolUse` hooks in `settings.json` read `$TOOL_INPUT`/`$TOOL_OUTPUT`, which are not part of the contract; three `scripts/*-fse/validate-theme-location.sh` copies read a `CLAUDE_TOOL_INPUT` variable that does not exist and used `grep -P` (absent on macOS) | Nine hooks on the stdin JSON contract (`lib/hook-io.sh` from Maecenas, `lib/flavian-helpers.sh`): the layout guard now answers with a JSON deny and scopes itself to the Flavian layout; `deploy-guard.sh` (new) asks before production deploys, rollbacks, remote writes and local data loss and denies them in subagents; `pre-commit-token-guard.sh` asks on hardcoded design values in committed theme files; `bundle-size-guard.sh`, four `post-bash-reminders.sh` cases, `session-context.sh`; `hooks.json` mirrors the registration for the plugin; the three per-agent copies exec the project hook. 70 hook tests, 17 bats checks |
| 3 | **Legacy commands** | Four files in `.claude/commands/`; two were Python lint/test instructions from another template, one targets a `cli-tool/` tree that does not exist here | Moved to skills: `scaffold-block` as is; `lint` and `test` rewritten for this repo's checks and suites; `create-blog-article` with a provenance note and `disable-model-invocation`. `.claude/commands/` deleted |
| 4 | **Skill file casing** | `fse-pattern-first-architecture/skill.md` (lowercase) loads only on a case-insensitive file system | Renamed to `SKILL.md`; 16 skills |
| 5 | **Progress tracking** | The figma pipeline tracked progress with `TodoWrite` and checkpointed to the `episodic-memory` plugin, neither of which exists | `.claude/pipeline/<theme>/state.json` (schema and resumption procedure in the skill; local to a checkout); the SessionStart hook reports runs in flight; the canva and InDesign pipelines reference the same file |
| 6 | **Parallel per-item lanes** | No workflow; the per-template loop was prose | `.claude/workflows/fse-template-lanes.js`: one lane per template (convert, validate, bounded fix loop), priority groups with a barrier, the state file's `templates` section written at the end; Step 2.4 of the skill calls it by name for three or more templates. Not yet exercised on a real conversion |
| 7 | **Rules and CLAUDE.md** | No `.claude/rules/`; a 670-line CLAUDE.md carrying the WordPress standards, six "installed" plugins that were not installed, `/commit` shortcuts from an absent plugin, and six `PostToolUse` hooks that never ran | Four rules (`wordpress-standards`, `claude-code-conventions`, `scripts-and-hooks`, `pipeline-artifacts`); CLAUDE.md rewritten as orientation (about 190 lines) |
| 8 | **Plugin packaging** | None; RCVMD wants to install four of the agents | `.claude-plugin/plugin.json`: 27 agents ship, 26 stay out through `metadata.excludedAgents` (13 names the `maecenas` plugin already ships, 13 with no WordPress job); skills, `hooks.json`, the workflow; `claude plugin validate .` passes; release-please keeps the version in step with `package.json`. The `pmds` marketplace lives in Maecenas, so `flavian@pmds` needs the entry added there (separate pull request) |
| 9 | **Evals** | None | `evals/`: `root-level-layout-holds`, `tokens-not-literals`, `no-prod-deploy`, each with a scaffold and mechanical graders plus one `llm` grader. Not run (model calls) |
| 10 | **Checker in CI** | Not present | `scripts/claude-code-conformance.js` + spec copied; `scripts/check-doc-counts.sh` (standalone port); `tests/claude-code/` (hooks, checker, doc counts) on `node:test`; `validate-configs.yml` runs the bats suites, the validator, the checker, the doc counts and the tests; `pnpm lint:claude`, `check:doc-counts`, `test:claude` |
| 11 | **Other defects found on the way** | `.mcp.json` started the Playwright MCP with `cmd /c` (fails on macOS and Linux); `scripts/validate-agent-configs.sh` used `declare -A` (bash 4) and accepted only `opus`, `sonnet`, `haiku` and `permissionMode: bypassPermissions`; `figma-fse-completion.sh` used GNU `find -printf` and double-printed `grep -c` zeros | Fixed: `npx`; a bash-3.2 duplicate check and the spec's model and permission values; portable `ls -t` and `|| true` |
| 12 | **Docs** | Counts of 12 skills and 6 plugins; `Task tool` wording; `PLUGINS-REFERENCE.md` and `SETUP-COMPLETE.md` describing plugins that were never installed | Counts 53 and 16 everywhere `check-doc-counts.sh` reads; `PLUGINS-REFERENCE.md` rewritten around the `flavian` plugin and the optional official plugins; `SETUP-COMPLETE.md` reduced to a dated status; `README.md`, `CUSTOM-AGENTS-GUIDE.md`, `scripts/README.md`, `TROUBLESHOOTING.md` aligned |

Not adopted, on purpose: agent teams, channels, output styles; `context: fork` research skills (no research skill exists here yet); a Flavian-local marketplace (one source of truth for `pmds` in Maecenas).

## 4. Decisions

1. **`ask`, not `deny`, for the token guard.** Flavian patterns carry inline SVG with `fill="#..."` (which the checks never match) and the occasional deliberate exception; the guard lists the findings and a human decides. Where a hook cannot prompt the answer is `deny`, so an unattended session cannot commit past it.
2. **The layout guard scopes itself.** The plugin's hooks load in every repo that enables it; RCVMD tracks `wp-content/themes/rcvmd/`, so an unscoped guard would deny its every theme write. It enforces only where a root `themes/` exists and nothing is tracked under `wp-content/`.
3. **The deploy guard strips heredoc bodies and quoted commit messages before classifying.** The first version fired on a documentation heredoc in the session that built it; text that only mentions a command is not a command.
4. **The state file is local.** Like Aurelius's `pipeline-state.json`, it belongs to one checkout; the theme is what gets committed.
5. **Excluding agents from the plugin is a manifest choice.** Every agent stays in `.claude/agents/`; a repo that wants a marketing agent installs `maecenas`.
6. **`lint` and `test` were rewritten, not moved.** Moving Python tooling instructions into a WordPress repo would make `/lint` run `black`. `create-blog-article` moved with a note saying it does not work here as written.
7. **`settings.json` carries hooks only.** The plan added `permissions.allow` rules for the repo's scripts and `ask` rules for `ssh`/`scp`/`rsync`; the auto-mode classifier refused a settings write that granted the agent session allow rules (self-modification), and rightly so. The gates live in the hooks; permission rules are Paul's to add.
8. **`model: opus` and `permissionMode: bypassPermissions` on 28 agents were left alone.** Out of the issue's scope; listed below.

## 5. What needs Paul

1. **Marketplace:** merge the Maecenas pull request that adds `flavian` to the `pmds` marketplace, then in RCVMD: `claude plugin marketplace add PMDevSolutions/Maecenas` and `claude plugin install flavian@pmds --scope project`. Until then nothing installs from here.
2. **Permissions:** add `permissions.allow` (`Bash(node scripts/*)`, `Bash(bash scripts/*)`, `Bash(./scripts/*)`, `Bash(pnpm test*)`, `Bash(node --test:*)`, `Bash(tests/bats/bin/bats:*)`) and `permissions.ask` (`Bash(ssh:*)`, `Bash(scp:*)`, `Bash(sftp:*)`, `Bash(rsync:*)`, the two deploy scripts) to `.claude/settings.json` if wanted; the hooks hold without them.
3. **Model and permission pins:** 28 agents run `model: opus` with `permissionMode: bypassPermissions`. Sonnet 5.5 is the default and subagents inherit the session model; with Fable and Opus usage being watched, dropping `model:` is the cheaper default. In bypass mode the deploy guard's `ask` is a `deny`, which is the intended behaviour but worth knowing.
4. **Evals:** run `claude plugin eval . --scaffold --allow-tools Write Edit Bash` once (model calls) and adjust the graders if a case is miscalibrated.
5. **First real run of `fse-template-lanes`:** the next Figma conversion with three or more templates is the integration test; watch `/workflows`.
6. **Oversized skills:** the six `SKILL.md` files over 500 lines.

## 6. Verification

```
node scripts/claude-code-conformance.js      → 0 error(s), 6 warning(s) — OK
bash scripts/check-doc-counts.sh             → 53 agents, 16 skills; in sync
node --test tests/claude-code/*.test.mjs     → 88 tests, 0 failing
tests/bats/bin/bats tests/validate-agent-configs.bats tests/figma-fse/validate-theme-location.bats tests/unit → pass
./scripts/validate-agent-configs-ci.sh       → pass
claude plugin validate .                     → Validation passed (advice only)
```

## 7. Sources

- https://code.claude.com/docs/en/sub-agents · /skills · /hooks · /plugins-reference · /workflows · /plugin-evals (fetched 2026-11-02)
- https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md (2.1.311 to 2.1.316)
- PMDevSolutions/Maecenas `scripts/claude-code-conformance.js`, `.claude/hooks/lib/hook-io.sh`, `.claude/rules/claude-code-conventions.md`; PMDevSolutions/Aurelius `.claude/hooks/deploy-guard.sh`, `.claude/workflows/component-lanes.js`, `evals/`; PMDevSolutions/RCVMD `.claude/hooks/deploy-guard.sh`, `.claude/rules/`
