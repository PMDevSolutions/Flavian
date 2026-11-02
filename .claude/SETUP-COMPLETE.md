# Claude Code Configuration Status

**Last reviewed:** 2026-11-02, the Claude Code SOTA conformance pass ([issue #167](https://github.com/PMDevSolutions/Flavian/issues/167), record in `docs/audits/2026-11-02-claude-code-sota-conformance.md`).

## What is in place

| Component | Count | Where | Check |
|-----------|-------|-------|-------|
| Agents | 53 (27 ship in the plugin) | `.claude/agents/` | `node scripts/claude-code-conformance.js` |
| Skills | 16 | `.claude/skills/` | same |
| Hooks | 9 scripts, registered in `settings.json` and mirrored in `hooks.json` | `.claude/hooks/` | `node --test tests/claude-code/hooks.test.mjs` |
| Rules | 4 path-scoped | `.claude/rules/` | loaded automatically |
| Workflow | `fse-template-lanes` | `.claude/workflows/` | called by the pipeline skills |
| Plugin manifest | `flavian` | `.claude-plugin/plugin.json` | `claude plugin validate .` |
| Evals | 3 cases | `evals/` | `claude plugin eval . --scaffold --allow-tools Write Edit Bash` (by hand) |
| MCP servers | `figma-desktop`, `figma`, `playwright` | `.mcp.json` | `/mcp` |

Status on 2026-11-02: conformance check 0 errors (6 warnings, all `SKILL.md` files over 500 lines), manifest valid, documented counts in sync, hook and checker tests green.

## Plugins

No Claude Code plugins are installed for this repository and none are required. `.claude/PLUGINS-REFERENCE.md` describes the `flavian` plugin this repo ships and the official plugins that fit WordPress work.

## History

This file began on 2026-01-18 as a plugin-setup checklist that listed six plugins as installed (`php-lsp`, `github`, `commit-commands`, `episodic-memory`, `ai-taskmaster`, `superpowers`). The 2026-11-02 audit found none of them installed on the development machine and the configuration written against an older Claude Code (retired tool names, hooks on a contract that never fired, legacy command files); the audit record has the before-and-after numbers and the decisions.
