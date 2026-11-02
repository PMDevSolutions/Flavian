#!/usr/bin/env bash
# pre-commit-token-guard.sh — PreToolUse hook (matcher: Bash, if: "Bash(git commit *)").
#
# Before a `git commit`, look at the theme files the commit carries (staged
# files, plus working-tree changes when the same command also runs `git add`
# or commits with -a) under themes/<name>/{templates,parts,patterns}/ and run
# the five checks the theme-token-auditor runs on every write:
#   1. a hex color inside a style="" attribute
#   2. a hex color inside a block's JSON attributes (border colors excepted)
#   3. pixel padding, margin or gap inside a style="" attribute
#   4. a pixel font-size inside a style="" attribute
#   5. a font-family inside a style="" attribute
# A finding → permissionDecision "ask" with the lines, so a human decides
# (inline SVG fills and other deliberate exceptions never match these checks,
# but a pattern can still carry a value the human wants to keep). Where a hook
# cannot prompt (bypassPermissions, dontAsk) the answer is "deny" with the
# reason. Silent when the commit carries no theme template, part or pattern.
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

hook_read_input
hook_read_context

[ "$TOOL_NAME" = "Bash" ] || exit 0
flavian_is_commit_command "$TOOL_COMMAND" || exit 0
command -v git >/dev/null 2>&1 || exit 0

cd "$(flavian_base_dir)" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

CARRIED="$(flavian_carried_files "$TOOL_COMMAND")"
FILES="$(printf '%s\n' "$CARRIED" | grep -E '(^|/)themes/[^/]+/(templates|parts|patterns)/.*\.(html|php)$' || true)"
[ -n "$FILES" ] || exit 0

# $1 = file. Prints one "file:line: text  <- kind" line per finding.
token_findings() {
  local f="$1"
  { grep -nE 'style="[^"]*#[0-9A-Fa-f]{3,8}' "$f" 2>/dev/null || true; } | awk -v f="$f" '{ print f ":" $0 "  <- hex color in a style attribute" }'
  { grep -nE '<!-- wp:[^>]*"[^"]*#[0-9A-Fa-f]{6}' "$f" 2>/dev/null | grep -v '"border"' || true; } | awk -v f="$f" '{ print f ":" $0 "  <- hex color in block attributes" }'
  { grep -nE 'style="[^"]*(padding|margin|gap)[^"]*[0-9]+px' "$f" 2>/dev/null || true; } | awk -v f="$f" '{ print f ":" $0 "  <- pixel spacing in a style attribute" }'
  { grep -nE 'style="[^"]*font-size:[[:space:]]*[0-9]+px' "$f" 2>/dev/null || true; } | awk -v f="$f" '{ print f ":" $0 "  <- pixel font-size in a style attribute" }'
  { grep -nE 'style="[^"]*font-family:' "$f" 2>/dev/null || true; } | awk -v f="$f" '{ print f ":" $0 "  <- font-family in a style attribute" }'
}

FINDINGS=""
while IFS= read -r file; do
  [ -n "$file" ] && [ -f "$file" ] || continue
  FOUND="$(token_findings "$file" || true)"
  [ -n "$FOUND" ] && FINDINGS="${FINDINGS}${FOUND}
"
done <<EOF
$FILES
EOF
[ -n "$FINDINGS" ] || exit 0

COUNT="$(printf '%s' "$FINDINGS" | grep -c . || true)"
SHOWN="$(printf '%s' "$FINDINGS" | head -n 12 | cut -c1-200)"
hook_gate_decision ask "Token guard: $COUNT hardcoded value(s) in theme files this commit carries. theme.json presets are the single source of truth: use var(--wp--preset--color--<slug>), the spacing presets (var(--wp--preset--spacing--<n>)) and the fontSize and fontFamily preset slugs, then re-stage and commit. Approve only for a deliberate exception. Findings:
$SHOWN"
exit 0
