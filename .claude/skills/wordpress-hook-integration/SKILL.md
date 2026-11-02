---
name: wordpress-hook-integration
description: Use when creating or changing Claude Code hooks in this template (PreToolUse guards, PostToolUse reminders, SessionStart context), registering them in settings.json and hooks.json, or testing them. Keywords: agent hooks, PreToolUse, PostToolUse, SessionStart, Claude Code hooks, hook-io, deploy guard, workflow automation
---

# Claude Code Hook Integration

## Overview

Hooks are shell scripts Claude Code runs at lifecycle events. In this template they enforce the root-level layout, stop deploys and data loss for a human, check commits for hardcoded design values, and remind the model to run the quality gate. Every hook follows one contract, lives in `.claude/hooks/`, and has a test in `tests/claude-code/hooks.test.mjs`.

The authoritative reference is https://code.claude.com/docs/en/hooks. The repo-specific conventions are in `.claude/rules/claude-code-conventions.md`.

## When to Use

- Adding a guard or reminder that should run for every agent
- Changing what a hook catches, or its message
- Registering a hook for the plugin build (`hooks.json`) as well as the project (`settings.json`)
- Writing or fixing a hook test

## Current Hook Architecture

Project hooks, registered in `.claude/settings.json` and mirrored in `.claude/hooks/hooks.json` for plugin installs:

| Hook | Event | What it does |
|------|-------|--------------|
| `validate-theme-location.sh` | PreToolUse `Write\|Edit\|NotebookEdit` | Denies writes under `wp-content/(themes\|plugins\|mu-plugins)/` with the corrected root-level path. Enforces only in a repo with a root `themes/` and nothing tracked under `wp-content/`. |
| `deploy-guard.sh` | PreToolUse `Bash` (`onFailure: block`) | Asks before `deploy.sh --env production`, any `rollback.sh`, `wp --ssh=`, remote `ssh`/`scp`/`rsync` writes, `docker compose down -v`, `wp db reset`; reminds on a staging deploy; denies all of it inside a subagent. |
| `agent-no-deploy.sh` | agent frontmatter PreToolUse `Bash` | `deploy-guard.sh --subagent`, for `deployment-agent` and `devops-automator`. |
| `pre-commit-token-guard.sh` | PreToolUse `Bash`, `if: "Bash(git commit *)"` | Asks when a theme template, part or pattern the commit carries has a hex colour, pixel spacing, pixel font-size or font-family in a `style` attribute or block JSON. |
| `bundle-size-guard.sh` | PreToolUse `Bash`, `if: "Bash(git commit *)"` | Reminder when a theme over 5120 KB or a plugin over 10240 KB is in the commit. |
| `post-bash-reminders.sh <case>` | PostToolUse `Bash`, one `if:` per case | `build-qa`, `coverage`, `dark-mode`, `mutation` reminders after standards checks, PHPUnit/Pest runs and visual diffs. |
| `session-context.sh` | SessionStart `startup\|resume\|clear\|compact` | Plain-text status: conversion runs in flight, themes, Docker, `.env`, branch, stray `wp-content/` files. Silent outside a Flavian checkout. |
| `figma-fse-post-template.sh`, `figma-fse-completion.sh` | run by the converter agent through Bash | Per-template validation and the completion report under `.claude/reports/`. |

Agent-scoped hooks live in each agent's frontmatter (`hooks:`) and point at `scripts/<agent>/*.sh` or the project hooks through `bash "$CLAUDE_PROJECT_DIR"/...`. Plugin agents ignore frontmatter hooks, so anything that must hold in a plugin install is registered at the settings level too.

Shared code: `.claude/hooks/lib/hook-io.sh` (the contract: readers and JSON emitters) and `.claude/hooks/lib/flavian-helpers.sh` (Bash output, commit detection, the files a commit carries).

## The Contract

- **Input:** the event as JSON on stdin. Common fields: `hook_event_name`, `cwd`, `permission_mode`, `session_id`; `agent_id` and `agent_type` when the hook fires inside a subagent. Tool events add `tool_name`, `tool_input` (`command` for Bash, `file_path` for Write/Edit) and, after the tool ran, `tool_response`.
- **Output:** one JSON object on stdout, or nothing. SessionStart hooks may print plain text, which is added to context.
- **Decisions:** a PreToolUse hook blocks with `permissionDecision: "deny"` or prompts with `"ask"`, each with a `permissionDecisionReason`. A reminder is `additionalContext`. A one-line user notice is a top-level `systemMessage`.
- **Exit code:** always 0. Exit 2 also blocks (stderr becomes the reason) but the hooks here never rely on it. A hook that crashes must fail open: `set -u` plus `trap 'exit 0' ERR`.
- **Not part of the contract:** `$TOOL_INPUT`, `$TOOL_OUTPUT`, `CLAUDE_TOOL_INPUT`. Hooks written against them never fire.
- **Where a hook cannot prompt** (`bypassPermissions`, `dontAsk`), `hook_gate_decision` turns an `ask` into a `deny` that says where to run the command instead.

## Creating a New Hook

```bash
#!/usr/bin/env bash
# my-guard.sh — PreToolUse hook (matcher: Bash). One paragraph on what it stops and why.
#
# Input: the hook event as JSON on stdin. Output: JSON on stdout, or nothing.
# Always exits 0.
set -u
trap 'exit 0' ERR

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/hook-io.sh
source "$HOOK_DIR/lib/hook-io.sh"
# shellcheck source=lib/flavian-helpers.sh
source "$HOOK_DIR/lib/flavian-helpers.sh"

hook_read_input      # HOOK_EVENT, TOOL_NAME, TOOL_COMMAND, TOOL_FILE_PATH, TOOL_RESPONSE
hook_read_context    # HOOK_PERMISSION_MODE, HOOK_AGENT_ID, HOOK_AGENT_TYPE, HOOK_CWD

[ "$TOOL_NAME" = "Bash" ] || exit 0
printf '%s' "$TOOL_COMMAND" | grep -Eq 'wp[[:space:]]+search-replace' || exit 0
printf '%s' "$TOOL_COMMAND" | grep -Eq -- '--dry-run' && exit 0

hook_gate_decision ask "Search-replace guard: this rewrites the database. Run it with --dry-run first."
exit 0
```

Rules:

1. Bash 3.2 compatible (macOS): no `grep -P`, `mapfile`, `${var,,}`, GNU `find -printf`.
2. Every command that may fail inside `$( )` gets `|| true`; the `ERR` trap otherwise ends the hook silently.
3. Filter early and cheaply (tool name, a `case` on the command) before anything heavy.
4. Messages start with a stable tag (`Deploy guard:`, `Token guard:`, `[bundle-guard]`) so tests and readers can find them.
5. Never write files, make network requests or take longer than a few seconds.

## Registering a Hook

In `.claude/settings.json` (project) and `.claude/hooks/hooks.json` (plugin), with the same handlers:

```json
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "if": "Bash(wp search-replace *)",
      "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/my-guard.sh",
      "timeout": 10,
      "statusMessage": "Checking the search-replace guard"
    }
  ]
}
```

`hooks.json` uses `bash "${CLAUDE_PLUGIN_ROOT}/.claude/hooks/my-guard.sh"`. An `if:` holds one permission rule and keeps the hook from starting for unrelated commands. `onFailure: "block"` makes a guard fail closed; reminders keep the default. The registration test fails if the two files drift apart.

## Testing Hooks

```bash
node --test tests/claude-code/hooks.test.mjs
```

Each hook gets: the contract cases (unrelated event, empty stdin, malformed JSON, executable bit, skeleton present) through the `HOOKS` list, plus behaviour cases built with `runHook(name, event, { cwd })`, `decision(out)`, `reason(out)` and `context(out)`. Repos with the Flavian layout come from `flavianRepo()`; a repo that tracks `wp-content/` from `wpContentRepo()`. A manual check:

```bash
printf '%s' '{"tool_name":"Write","tool_input":{"file_path":"wp-content/themes/x/style.css"}}' \
  | CLAUDE_PROJECT_DIR="$PWD" bash .claude/hooks/validate-theme-location.sh
# {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny", ...}}
```

The conformance check (`node scripts/claude-code-conformance.js`) fails on a hook that reads positional `TOOL_INPUT`, lacks the `ERR` trap, or is registered under an unknown event or with a missing script.

## No Exceptions

Never create hooks that run for more than a few seconds, modify files, make network requests, block silently, or run destructive operations. A guard asks a human; it does not act.

## Integration with This Template

The hooks hold the template's hard rules at runtime for every agent: the root-level layout, no unreviewed deploy or data loss, no hardcoded design values in a commit. Agents that run their own validators (the three converters, the validators and auditors, the test and performance agents) declare those in their frontmatter and point at `scripts/<agent>/`.

---

**Skill Version:** 3.0.0
**Last Updated:** 2026-11-02
