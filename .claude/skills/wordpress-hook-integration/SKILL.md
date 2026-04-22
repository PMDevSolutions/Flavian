---
name: wordpress-hook-integration
description: Use when creating Claude Code agent hooks, implementing PreToolUse or PostToolUse patterns, or integrating WordPress workflows with custom agents in this template. Keywords: agent hooks, PreToolUse, PostToolUse, Claude Code hooks, custom agents, workflow automation, WordPress automation
---

# WordPress Hook Integration for Claude Code Agents

## Overview

Claude Code agent hooks execute shell scripts before/after tool use. This template uses hooks to enforce project conventions, validate generated themes, and run quality checks during the Figma-to-FSE pipeline.

**Core Principle:** Hooks automate quality enforcement and project rules without manual intervention. They warn or block based on severity.

## When to Use

Use this skill when:
- Creating hooks for custom agents in this template
- Adding validation to the Figma-to-FSE conversion pipeline
- Enforcing project conventions (e.g., root-level file locations)
- Running quality checks after template generation
- Understanding or modifying existing hook behavior

**Symptoms that trigger this skill:**
- "create hook"
- "agent hook"
- "PreToolUse"
- "PostToolUse"
- "validate template"
- "block markup"

## Current Hook Architecture

This template has 3 active hooks in `.claude/hooks/`:

```
.claude/hooks/
├── validate-theme-location.sh       # PreToolUse: Blocks writes to wp-content/
├── figma-fse-post-template.sh       # PostToolUse: Validates each generated template
└── figma-fse-completion.sh          # PostToolUse: Final conversion report and validation
```

### Hook 1: validate-theme-location.sh (PreToolUse)

**Purpose:** Enforces root-level file structure. Blocks any Write/Edit targeting `wp-content/themes/`, `wp-content/plugins/`, or `wp-content/mu-plugins/`.

**Behavior:**
- Reads JSON input from stdin (Claude Code tool input format)
- Extracts `file_path` from tool input
- If path contains `wp-content/(themes|plugins|mu-plugins)/`, exits with code 2 (blocks operation)
- Suggests the corrected root-level path
- Runs for ALL agents, not just figma-fse-converter

**Exit codes:**
- `0` — Path is valid, allow operation
- `2` — Path targets wp-content, block operation

### Hook 2: figma-fse-post-template.sh (PostToolUse)

**Purpose:** Validates each FSE template after creation during Figma-to-FSE conversion.

**Behavior:**
- Only triggers for HTML files matching `themes/*/templates/*.html`
- Runs template validation, security scan, and coding standards checks
- Always exits 0 (warns, never blocks) to avoid interrupting conversion flow
- Delegates to `scripts/figma-fse/validate-template.sh`, `scripts/wordpress/security-scan.sh`, and `scripts/wordpress/check-coding-standards.sh` if they exist

### Hook 3: figma-fse-completion.sh (PostToolUse / Manual)

**Purpose:** Runs after all Figma-to-FSE templates are complete. Generates a full conversion report.

**Checks performed:**
1. Counts generated files (templates, parts, patterns)
2. Validates zero hardcoded hex colors and pixel sizes in templates
3. Checks block balance (open/close comment pairs)
4. Validates theme.json design tokens (color count, font sizes, spacing)
5. Runs security scan and coding standards check
6. Generates a Markdown completion report in `.claude/reports/`

**Can run manually:**
```bash
bash .claude/hooks/figma-fse-completion.sh themes/my-theme
```

## Hook Types

| Hook Type | When It Runs | Exit Code Behavior |
|-----------|--------------|-------------------|
| **PreToolUse** | Before tool execution | `0` = allow, `2` = block |
| **PostToolUse** | After tool execution | `0` = success (warnings OK), non-zero = report issue |

## Creating New Hooks

### Input Format

Hooks receive JSON on stdin from Claude Code:

```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "themes/my-theme/templates/index.html",
    "content": "..."
  }
}
```

Extract values with `jq`:
```bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
```

### Pattern: Blocking Hook (PreToolUse)

```bash
#!/bin/bash
# Hook: PreToolUse - blocks invalid operations

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Skip if no file path
[ -z "$FILE_PATH" ] && exit 0

# Check condition
if [[ "$FILE_PATH" =~ some-bad-pattern ]]; then
    echo "BLOCKED: Reason" >&2
    exit 2
fi

exit 0
```

### Pattern: Warning Hook (PostToolUse)

```bash
#!/bin/bash
# Hook: PostToolUse - warns but does not block

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Only process relevant files
[[ ! "$FILE_PATH" =~ \.php$ ]] && exit 0

# Run check
echo "Running check on $FILE_PATH..." >&2
# ... validation logic ...

# Always exit 0 (warn, don't block)
exit 0
```

## Hook Best Practices

1. **Output to stderr** — Use `>&2` for all echo statements (stdout is reserved for Claude Code)
2. **Fast execution** — Hooks should complete in < 5 seconds
3. **Read from stdin** — Claude Code passes tool input as JSON on stdin
4. **Use jq for parsing** — Extract fields with `jq -r '.tool_input.field // empty'`
5. **Exit 0 for warnings** — Only use exit 2 for hard blocks (PreToolUse)
6. **Filter by file path** — Check patterns early and exit 0 if not relevant
7. **Idempotent** — Safe to run multiple times on the same input

## Integration with 19 Custom Agents

All hooks run for every agent. Use file path patterns and tool name checks to scope hooks to specific workflows:

```bash
# Only for figma-fse-converter output
[[ ! "$FILE_PATH" =~ themes/.*/templates/.*\.html$ ]] && exit 0

# Only for PHP pattern files
[[ ! "$FILE_PATH" =~ themes/.*/patterns/.*\.php$ ]] && exit 0

# Only for theme.json changes
[[ ! "$FILE_PATH" =~ theme\.json$ ]] && exit 0
```

## Testing Hooks

```bash
# Test validate-theme-location with a blocked path
echo '{"tool_input":{"file_path":"wp-content/themes/test/style.css"}}' | bash .claude/hooks/validate-theme-location.sh
echo $?  # Should be 2

# Test with a valid path
echo '{"tool_input":{"file_path":"themes/test/style.css"}}' | bash .claude/hooks/validate-theme-location.sh
echo $?  # Should be 0

# Test completion hook manually
bash .claude/hooks/figma-fse-completion.sh themes/my-theme
```

## No Exceptions

**NEVER create hooks that:**

1. Run for extended periods (> 10 seconds) without user notification
2. Modify files without user knowledge
3. Make network requests without disclosure
4. Block critical operations silently
5. Ignore error conditions
6. Run destructive operations (delete, reset) without confirmation

## Integration with This Template

This skill enables:
- **Root-level path enforcement** via validate-theme-location.sh
- **Per-template validation** via figma-fse-post-template.sh
- **Conversion completion reports** via figma-fse-completion.sh

Works with all 49 custom agents in this template.

---

**Skill Version:** 2.0.0
**Last Updated:** 2026-03-06
