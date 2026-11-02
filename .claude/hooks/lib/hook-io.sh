#!/usr/bin/env bash
# hook-io.sh — shared stdin/stdout contract for every hook under .claude/hooks/.
#
# Claude Code passes each hook event as JSON on stdin and reads JSON back on
# stdout (docs: https://code.claude.com/docs/en/hooks). Source this file at the
# top of a hook, after `set -u` and the `trap 'exit 0' ERR` guard:
#
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/hook-io.sh"
#   hook_read_input          # fills HOOK_EVENT, TOOL_NAME, TOOL_COMMAND, ...
#
# Field readers prefer jq (ships with macOS and every CI image used here) and
# fall back to node, which the project already requires. Every function is
# defensive: on any failure it returns an empty string so the calling hook can
# still `exit 0` and never break a session.

hook_json_get() {
  # $1 = dotted path, e.g. tool_input.command  →  prints the value or nothing.
  local path="$1"
  [ -n "${HOOK_JSON:-}" ] || return 0
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$HOOK_JSON" | jq -r --arg p "$path" '
      getpath($p | split(".")) // empty
      | if type == "string" then . else tostring end' 2>/dev/null || true
  else
    HOOK_JSON="$HOOK_JSON" node -e '
      const path = process.argv[1].split(".");
      let v; try { v = JSON.parse(process.env.HOOK_JSON); } catch { process.exit(0); }
      for (const k of path) { if (v == null) break; v = v[k]; }
      if (v == null) process.exit(0);
      process.stdout.write(typeof v === "string" ? v : JSON.stringify(v));
    ' "$path" 2>/dev/null || true
  fi
}

hook_read_input() {
  HOOK_JSON="$(cat 2>/dev/null || true)"
  HOOK_EVENT="$(hook_json_get hook_event_name)"
  TOOL_NAME="$(hook_json_get tool_name)"
  TOOL_COMMAND="$(hook_json_get tool_input.command)"
  TOOL_FILE_PATH="$(hook_json_get tool_input.file_path)"
  # tool_response is a string for Bash, an object for most other tools.
  TOOL_RESPONSE="$(hook_json_get tool_response)"
  export HOOK_JSON HOOK_EVENT TOOL_NAME TOOL_COMMAND TOOL_FILE_PATH TOOL_RESPONSE
}

hook_read_context() {
  # Fills HOOK_PERMISSION_MODE, HOOK_AGENT_ID, HOOK_AGENT_TYPE and HOOK_CWD from
  # the event in one jq (or node) call; call it after hook_read_input. agent_id
  # is present only when the hook fires inside a subagent or an in-process
  # teammate; agent_type is also set in a main session started with --agent,
  # so agent_id is the subagent signal.
  local line=""
  if [ -n "${HOOK_JSON:-}" ]; then
    if command -v jq >/dev/null 2>&1; then
      line="$(printf '%s' "$HOOK_JSON" | jq -r '[.permission_mode, .agent_id, .agent_type, .cwd]
        | map(if . == null then "" else tostring end) | join("\u001f")' 2>/dev/null || true)"
    else
      line="$(HOOK_JSON="$HOOK_JSON" node -e '
        let v; try { v = JSON.parse(process.env.HOOK_JSON); } catch { process.exit(0); }
        const f = (x) => (x == null ? "" : String(x));
        process.stdout.write([v.permission_mode, v.agent_id, v.agent_type, v.cwd].map(f).join("\u001f"));
      ' 2>/dev/null || true)"
    fi
  fi
  IFS=$'\037' read -r HOOK_PERMISSION_MODE HOOK_AGENT_ID HOOK_AGENT_TYPE HOOK_CWD <<<"$line" || true
  HOOK_PERMISSION_MODE="${HOOK_PERMISSION_MODE:-}"; HOOK_AGENT_ID="${HOOK_AGENT_ID:-}"
  HOOK_AGENT_TYPE="${HOOK_AGENT_TYPE:-}"; HOOK_CWD="${HOOK_CWD:-}"
  export HOOK_PERMISSION_MODE HOOK_AGENT_ID HOOK_AGENT_TYPE HOOK_CWD
}

hook_json_string() {
  # Encode $1 as a JSON string literal (with quotes).
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$1" | jq -Rs '.' 2>/dev/null || printf '""'
  else
    node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1" 2>/dev/null || printf '""'
  fi
}

# --- Emitters: each prints one JSON document to stdout --------------------

hook_pretooluse_decision() {
  # $1 = allow | deny | ask   $2 = reason shown to the user (and to Claude on deny)
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"%s","permissionDecisionReason":%s}}\n' \
    "$1" "$(hook_json_string "$2")"
}

hook_gate_decision() {
  # $1 = ask | deny   $2 = reason. A hook's "ask" prompts in default and auto
  # mode; bypassPermissions and dontAsk are not documented to prompt, so there
  # an "ask" becomes a "deny" that says where to run the command instead (the
  # rule Bridleway's prod-guard.sh uses, PMDevSolutions/Bridleway#598 S4).
  # Reads HOOK_PERMISSION_MODE from hook_read_context.
  local decision="$1" reason="$2"
  if [ "$decision" = "ask" ]; then
    case "${HOOK_PERMISSION_MODE:-}" in
      bypassPermissions|dontAsk)
        decision="deny"
        reason="$reason (This session runs in ${HOOK_PERMISSION_MODE}, where a hook cannot prompt; run it from a session in default or auto mode, or a human runs it by hand.)" ;;
    esac
  fi
  hook_pretooluse_decision "$decision" "$reason"
}

hook_additional_context() {
  # $1 = hook event name (PreToolUse | PostToolUse | SessionStart | UserPromptSubmit)
  # $2 = text to add to Claude's context
  printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":%s}}\n' \
    "$1" "$(hook_json_string "$2")"
}

hook_system_message() {
  # $1 = one-line message shown to the user in the transcript
  printf '{"systemMessage":%s}\n' "$(hook_json_string "$1")"
}

# --- Project helpers ------------------------------------------------------

hook_project_dir() {
  printf '%s' "${CLAUDE_PROJECT_DIR:-$(pwd)}"
}
