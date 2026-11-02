#!/usr/bin/env bash
# validate-theme-location.sh — PreToolUse hook (matcher: Write|Edit|NotebookEdit).
#
# Flavian develops themes, plugins and must-use plugins in root-level folders
# (themes/, plugins/, mu-plugins/); the deployment scripts copy them into
# wp-content/. A Write or Edit that targets wp-content/(themes|plugins|
# mu-plugins)/ is denied with the corrected root-level path, for every agent.
#
# Scoped to the Flavian layout: the guard enforces only when the project root
# has a themes/ directory and git tracks nothing under wp-content/. The plugin's
# copy of this hook therefore stays silent in a repo that keeps its theme under
# wp-content/themes/ (a client site such as RCVMD).
#
# Registered in .claude/settings.json for every session, mirrored in
# .claude/hooks/hooks.json for plugin installs, and referenced from the
# frontmatter of the agents that write theme files (the three
# scripts/*-fse/validate-theme-location.sh wrappers exec this file).
#
# Input: the hook event as JSON on stdin. Output: JSON on stdout, or nothing.
# Always exits 0.
set -u
trap 'exit 0' ERR

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/hook-io.sh
source "$HOOK_DIR/lib/hook-io.sh"

hook_read_input
hook_read_context

case "$TOOL_NAME" in
  Write|Edit|NotebookEdit|MultiEdit|"") ;;
  *) exit 0 ;;
esac

FILE_PATH="$TOOL_FILE_PATH"
[ -n "$FILE_PATH" ] || FILE_PATH="$(hook_json_get tool_input.notebook_path)"
[ -n "$FILE_PATH" ] || FILE_PATH="$(hook_json_get tool_input.path)"
[ -n "$FILE_PATH" ] || exit 0

printf '%s' "$FILE_PATH" | grep -Eq '(^|/)wp-content/(themes|plugins|mu-plugins)/' || exit 0

PROJECT="$(hook_project_dir)"
[ -d "$PROJECT/themes" ] || exit 0
if command -v git >/dev/null 2>&1; then
  TRACKED="$(git -C "$PROJECT" ls-files -- wp-content 2>/dev/null | head -n 1 || true)"
  [ -z "$TRACKED" ] || exit 0
fi

CORRECTED="$(printf '%s' "$FILE_PATH" | sed -E 's#(^|/)wp-content/(themes|plugins|mu-plugins)/#\1\2/#')"
hook_pretooluse_decision deny "Root-level layout: $FILE_PATH targets wp-content/, which this project never writes during development. Themes, plugins and must-use plugins live at the project root (themes/, plugins/, mu-plugins/) and reach wp-content/ only through the deployment scripts. Write to $CORRECTED instead."
exit 0
