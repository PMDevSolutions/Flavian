#!/usr/bin/env bash
# bundle-size-guard.sh — PreToolUse hook (matcher: Bash, if: "Bash(git commit *)").
#
# Before a `git commit`, measure every themes/<name> and plugins/<name>
# directory the commit touches. Above 5120 KB for a theme or 10240 KB for a
# plugin, return a reminder to Claude. The commit proceeds: large assets can
# be intentional, and the reminder names the directory to review.
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

MAX_THEME_KB=5120
MAX_PLUGIN_KB=10240

hook_read_input
hook_read_context

[ "$TOOL_NAME" = "Bash" ] || exit 0
flavian_is_commit_command "$TOOL_COMMAND" || exit 0
command -v git >/dev/null 2>&1 || exit 0

cd "$(flavian_base_dir)" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

DIRS="$(flavian_carried_files "$TOOL_COMMAND" | sed -nE 's#^((themes|plugins)/[^/]+)/.*#\1#p' | sort -u || true)"
[ -n "$DIRS" ] || exit 0

NOTES=""
while IFS= read -r dir; do
  [ -n "$dir" ] && [ -d "$dir" ] || continue
  SIZE_KB="$(du -sk "$dir" 2>/dev/null | cut -f1 | tr -d ' ' || true)"
  case "$SIZE_KB" in ''|*[!0-9]*) continue ;; esac
  case "$dir" in
    themes/*) LIMIT="$MAX_THEME_KB"; KIND="theme" ;;
    *) LIMIT="$MAX_PLUGIN_KB"; KIND="plugin" ;;
  esac
  if [ "$SIZE_KB" -gt "$LIMIT" ]; then
    NOTES="${NOTES}${dir} is ${SIZE_KB}KB, above the ${LIMIT}KB limit for a ${KIND}. "
  fi
done <<EOF
$DIRS
EOF
[ -n "$NOTES" ] || exit 0

hook_additional_context PreToolUse "[bundle-guard] ${NOTES}The commit proceeds; review the directory for large images or vendored assets before shipping (optimise images, move binaries out of the theme, or document why the size is intended)."
exit 0
