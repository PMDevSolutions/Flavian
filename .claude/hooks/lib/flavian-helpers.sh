#!/usr/bin/env bash
# flavian-helpers.sh — Flavian helpers shared by the hooks under .claude/hooks/.
#
# Source after lib/hook-io.sh, then call hook_read_input and hook_read_context:
#
#   source "$HOOK_DIR/lib/hook-io.sh"
#   source "$HOOK_DIR/lib/flavian-helpers.sh"
#   hook_read_input
#   hook_read_context
#
# Every function prints a value or nothing and never fails, so a hook can
# always `exit 0`. Bash 3.2 compatible (macOS system bash).

flavian_is_flavian_checkout() {
  # $1 = directory. True when it is a Flavian checkout: the CLI entry point
  # exists. The plugin's hooks load in every repo that enables the plugin, and
  # the Flavian-specific hooks stay quiet elsewhere.
  [ -f "${1:-}/bin/flavian.mjs" ]
}

flavian_base_dir() {
  # The directory the tool call runs in: the event's cwd, else the project dir.
  if [ -n "${HOOK_CWD:-}" ] && [ -d "$HOOK_CWD" ]; then
    printf '%s' "$HOOK_CWD"
  else
    hook_project_dir
  fi
}

flavian_bash_output() {
  # stdout and stderr of a Bash tool_response. Current events carry an object
  # ({stdout, stderr, interrupted, isImage}); older ones carry a string.
  if [ -z "${HOOK_JSON:-}" ]; then
    printf '%s' "${TOOL_RESPONSE:-}"
    return 0
  fi
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$HOOK_JSON" | jq -r '.tool_response
      | if type == "object" then ((.stdout // "") + "\n" + (.stderr // ""))
        elif type == "string" then .
        else "" end' 2>/dev/null || true
  else
    HOOK_JSON="$HOOK_JSON" node -e '
      let v; try { v = JSON.parse(process.env.HOOK_JSON).tool_response; } catch { process.exit(0); }
      if (v && typeof v === "object") process.stdout.write(`${v.stdout ?? ""}\n${v.stderr ?? ""}`);
      else if (typeof v === "string") process.stdout.write(v);
    ' 2>/dev/null || true
  fi
}

flavian_is_commit_command() {
  # $1 = command text. True for a `git commit`, including `git -C <dir> commit`.
  case "${1:-}" in
    *"git commit"*|*"git -C "*" commit"*) return 0 ;;
    *) return 1 ;;
  esac
}

flavian_carried_files() {
  # $1 = command text. The files the commit will carry, one per line, relative
  # to the current directory: the staged adds and changes, plus the working-tree
  # changes to tracked files when the command commits with -a/--all/-am, plus
  # untracked files when the same command also runs `git add`.
  local cmd="${1:-}" files
  files="$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)"
  case "$cmd" in
    *"commit -a"*|*"commit --all"*|*" -am "*|*" -am"|*" -a "*|*" -a")
      files="$files
$(git diff HEAD --name-only --diff-filter=ACMR 2>/dev/null || true)" ;;
  esac
  case "$cmd" in
    *"git add"*)
      files="$files
$(git diff HEAD --name-only --diff-filter=ACMR 2>/dev/null || true)
$(git ls-files --others --exclude-standard 2>/dev/null || true)" ;;
  esac
  printf '%s\n' "$files" | sed '/^$/d' | sort -u
}
