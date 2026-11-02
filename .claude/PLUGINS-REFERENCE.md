# Plugins Reference

**Last Updated:** 2026-11-02 (verified against Claude Code 2.1.316)

## What is installed

Nothing, and nothing is needed. This repository's agents, skills, hooks, rules and workflow live in `.claude/` and load on their own. Earlier versions of this document listed six plugins (`episodic-memory`, `commit-commands`, `github`, `php-lsp`, `superpowers`, `ai-taskmaster`) as installed; none of them was installed on the development machine when the 2026-11-02 conformance pass checked (`~/.claude/plugins/installed_plugins.json` held only `typescript-lsp`, for another repo), and the docs that depended on them (`/commit`, episodic-memory checkpoints, `TodoWrite` progress) have been corrected. Check a machine with:

```bash
claude plugin list          # installed plugins and their scopes
/plugin                     # the same, inside a session, with the marketplace browser
```

## This repo is a plugin: `flavian`

`.claude-plugin/plugin.json` points at the live `.claude/agents` files, `.claude/skills`, `.claude/hooks/hooks.json` and `.claude/workflows`, so the repo is both a project and an installable plugin with one source of truth.

| Ships | Detail |
|-------|--------|
| 27 of the 53 agents | The WordPress and web-engineering agents (`accessibility-auditor`, `block-markup-validator`, `theme-token-auditor`, `visual-qa-agent`, the three converters, `frontend-developer`, `plugin-developer`, `woocommerce-agent`, `headless-developer`, `deployment-agent`, and the rest). `metadata.excludedAgents` keeps 26 in the repo but out of the plugin: 13 whose names the `maecenas` plugin already ships, 13 with no WordPress job. |
| 16 skills | All of `.claude/skills/`. The pipeline skills call `./scripts/...` and need a Flavian checkout; the knowledge skills and `/lint`, `/test`, `/scaffold-block` work anywhere the referenced scripts exist. |
| Hooks | `.claude/hooks/hooks.json`: the root-level layout guard (silent in a repo that tracks `wp-content/`), the deploy guard, the commit guards, the reminders, the session status (silent outside a Flavian checkout). |
| Workflow | `fse-template-lanes` |

Install in another repo through the `pmds` marketplace, which lives in Maecenas:

```bash
claude plugin marketplace add PMDevSolutions/Maecenas
claude plugin install flavian@pmds --scope project     # writes enabledPlugins to that repo's .claude/settings.json
claude plugin update flavian@pmds                      # later
```

Plugin agents run without their frontmatter `hooks`, `mcpServers` and `permissionMode` (Claude Code ignores those for plugin agents); the settings-level hooks in `hooks.json` are what hold there. Validate the manifest after any change with `claude plugin validate .`; the conformance check (`node scripts/claude-code-conformance.js`) fails if the `agents` list drifts from `.claude/agents/`.

First consumer: RCVMD (PMDevSolutions/RCVMD#10) plans to use `accessibility-auditor`, `block-markup-validator`, `theme-token-auditor` and `visual-qa-agent` from this plugin instead of carrying copies.

## Official plugins that fit WordPress work (optional)

From the official marketplace (`claude-plugins-official`, registered by default). Install with `claude plugin install <name>@claude-plugins-official`.

| Plugin | What it adds | When it is worth it |
|--------|--------------|---------------------|
| `php-lsp` | PHP language server (go-to-definition, diagnostics) for themes and plugins | Any session editing PHP; needs Intelephense or a compatible server installed |
| `commit-commands` | `/commit`, `/commit-push-pr`, `/clean_gone` shortcuts | If you want structured commits without typing the git commands |
| `github` | GitHub MCP tools (PRs, issues, reviews) | The `gh` CLI covers the same ground; install if you prefer tool calls |
| `playwright` | Browser automation tools | The visual QA and accessibility agents can use the project's `.mcp.json` Playwright server already |
| `figma`, `canva` | Design-source MCP tools | The Figma pipeline uses the project's `.mcp.json` Figma servers; Canva export parsing needs no MCP |
| `code-review` | `/code-review` on a branch or PR | Review gate before merge |

None of these is required by anything in this repository.

## Skills vs Agents vs Plugins

| Type | Purpose | Invocation | Example |
|------|---------|------------|---------|
| **Skills** | Workflows and standards | Keyword detection, or `/<name>` | "create block theme" triggers `fse-block-theme-development`; `/lint` |
| **Agents** | Specialized task execution in a subagent | The Agent tool, on delegation or request | `frontend-developer` builds a pattern |
| **Hooks** | Guards and reminders at lifecycle events | Automatic | `deploy-guard.sh` asks before a production deploy |
| **Plugins** | A packaged set of the above, installed from a marketplace | `claude plugin install` | `flavian@pmds` |

## Verify

```bash
claude plugin validate .                        # manifest
node scripts/claude-code-conformance.js         # agents, skills, hooks, manifest list
claude plugin list                              # what this machine has installed
```
