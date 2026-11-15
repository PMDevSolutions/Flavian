#!/usr/bin/env bash
# Shared helpers for the remote-deployment scripts.
#
# Provides:
#   * Coloured logging that always goes to stderr
#   * Project-root resolution
#   * Release-id (timestamp + short git sha) generation
#   * Run-id correlation across log/notify/rollback steps
#   * Standard log-file path used by every script in this directory

# Resolve the project root once and cache it. Works regardless of the caller's CWD.
if [[ -z "${PROJECT_ROOT:-}" ]]; then
  PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
  export PROJECT_ROOT
fi

DEPLOY_LOG_DIR="${DEPLOY_LOG_DIR:-$PROJECT_ROOT/.claude/logs/deployment}"
mkdir -p "$DEPLOY_LOG_DIR"

# Generate a stable run-id once per orchestration. Child scripts inherit it.
if [[ -z "${DEPLOY_RUN_ID:-}" ]]; then
  DEPLOY_RUN_ID="$(date -u +"%Y%m%dT%H%M%SZ")-$$"
  export DEPLOY_RUN_ID
fi

DEPLOY_LOG_FILE="${DEPLOY_LOG_FILE:-$DEPLOY_LOG_DIR/$DEPLOY_RUN_ID.log}"
export DEPLOY_LOG_FILE

# ANSI codes are suppressed when stderr is not a TTY (CI logs, file capture).
if [[ -t 2 ]]; then
  _C_RESET=$'\033[0m'; _C_RED=$'\033[31m'; _C_YEL=$'\033[33m'
  _C_GRN=$'\033[32m'; _C_CYAN=$'\033[36m'; _C_DIM=$'\033[2m'
else
  _C_RESET=""; _C_RED=""; _C_YEL=""; _C_GRN=""; _C_CYAN=""; _C_DIM=""
fi

_log_raw() {
  local level="$1" colour="$2" msg="$3"
  local ts
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  printf '%s[%s]%s %s%-5s%s %s\n' \
    "$_C_DIM" "$ts" "$_C_RESET" "$colour" "$level" "$_C_RESET" "$msg" >&2
  printf '[%s] %-5s %s\n' "$ts" "$level" "$msg" >> "$DEPLOY_LOG_FILE"
}

log_info()  { _log_raw "INFO"  "$_C_CYAN" "$*"; }
log_ok()    { _log_raw "OK"    "$_C_GRN"  "$*"; }
log_warn()  { _log_raw "WARN"  "$_C_YEL"  "$*"; }
log_error() { _log_raw "ERROR" "$_C_RED"  "$*"; }
log_step()  { _log_raw "STEP"  "$_C_CYAN" "==> $*"; }

# Emit a single structured event to the log file. Used by notify.sh and the
# orchestrator so external tooling can tail the log and react to milestones.
log_event() {
  local event="$1"; shift
  local payload="${*:-}"
  local ts
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  printf '[%s] EVENT %s %s\n' "$ts" "$event" "$payload" >> "$DEPLOY_LOG_FILE"
}

# Compute a release identifier that combines a timestamp with the short SHA of
# HEAD. Falls back to "nogit" when the worktree is detached from a repo.
generate_release_id() {
  local ts sha
  ts="$(date -u +"%Y%m%dT%H%M%SZ")"
  if sha="$(git -C "$PROJECT_ROOT" rev-parse --short=8 HEAD 2>/dev/null)"; then
    printf '%s-%s' "$ts" "$sha"
  else
    printf '%s-nogit' "$ts"
  fi
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Required command not found: $cmd"
    return 1
  fi
}

# Print a banner around significant phases so the log is scannable.
banner() {
  local msg="$*"
  local line
  line="$(printf '%*s' "${#msg}" '' | tr ' ' '=')"
  log_info "$line"
  log_info "$msg"
  log_info "$line"
}
