#!/usr/bin/env bash
# validate-theme-location.sh — PreToolUse hook (matcher: Write|Edit) declared in
# the frontmatter of the figma-fse-converter agent.
#
# Thin wrapper: the project-level hook at .claude/hooks/validate-theme-location.sh
# is the single implementation (event JSON on stdin, a JSON permissionDecision
# on stdout, always exit 0). It is kept at this path because the agent's
# frontmatter references it; the project hook in .claude/settings.json already
# covers every agent, so this copy only matters when the agent file travels on
# its own.
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.claude/hooks/validate-theme-location.sh" "$@"
