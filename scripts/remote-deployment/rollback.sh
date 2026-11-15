#!/usr/bin/env bash
# Rollback a remote deployment to a previous release.
#
# For SSH/SFTP deployments this swaps the `current` symlink back to the
# previous release directory. For Git deployments it force-pushes the previous
# remote commit (with explicit confirmation).
#
# Usage:
#   rollback.sh --env <name> [--method ssh|git] [--to <release-id|sha>]
#                            [--list]
#
# Without --to, rolls back to the immediate previous release (ssh) or HEAD~1
# of the deployed branch (git).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/config-loader.sh"

ENV_NAME=""
METHOD=""
TO=""
LIST=false

usage() {
  cat <<EOF
Usage: $(basename "$0") --env <name> [--method ssh|git] [--to ID|SHA] [--list]

  --env NAME      environment to roll back
  --method MODE   ssh (default) or git
  --to ID|SHA     specific release id (ssh) or commit sha (git)
  --list          list available rollback targets and exit
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_NAME="$2"; shift 2 ;;
    --method) METHOD="$2"; shift 2 ;;
    --to) TO="$2"; shift 2 ;;
    --list) LIST=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) log_error "Unknown argument: $1"; usage; exit 2 ;;
  esac
done

[[ -n "$ENV_NAME" ]] || { log_error "--env is required"; exit 2; }
load_environment_config "$ENV_NAME"
METHOD="${METHOD:-${DEPLOY_CFG_METHOD:-ssh}}"

rollback_ssh() {
  require_cmd ssh || exit 2
  local host user port key root
  host="$(require_cfg SSH_HOST)" || exit 1
  user="$(require_cfg SSH_USER)" || exit 1
  port="${DEPLOY_CFG_SSH_PORT:-22}"
  key="${DEPLOY_CFG_SSH_KEY:-}"
  root="$(require_cfg REMOTE_ROOT)" || exit 1

  local opts=(-o StrictHostKeyChecking=accept-new -o BatchMode=yes -p "$port")
  [[ -n "$key" ]] && opts+=(-i "$key")
  remote() { ssh "${opts[@]}" "$user@$host" "$@"; }

  if $LIST; then
    log_step "Available releases on $host:"
    remote "ls -1t '$root/releases'"
    return 0
  fi

  local current target
  current="$(remote "readlink '$root/current' 2>/dev/null | xargs -n1 basename" || true)"
  if [[ -z "$TO" ]]; then
    target="$(remote "ls -1t '$root/releases'" | awk -v cur="$current" '$0 != cur {print; exit}')"
    [[ -n "$target" ]] || { log_error "No previous release available to roll back to"; return 1; }
  else
    target="$TO"
    if ! remote "test -d '$root/releases/$target'"; then
      log_error "Release '$target' not found on remote"
      return 1
    fi
  fi

  banner "Rolling back $ENV_NAME: $current → $target"
  log_event "rollback_start" "env=$ENV_NAME from=$current to=$target method=ssh"

  remote "ln -sfn '$root/releases/$target' '$root/current.new' && \
          mv -Tf '$root/current.new' '$root/current'"

  log_ok "Rollback complete: current → $target"
  log_event "rollback_ok" "env=$ENV_NAME to=$target method=ssh"
}

rollback_git() {
  require_cmd git || exit 2
  local remote_url remote_branch remote_name
  remote_url="$(require_cfg GIT_REMOTE_URL)" || exit 1
  remote_branch="$(require_cfg GIT_REMOTE_BRANCH)" || exit 1
  remote_name="${DEPLOY_CFG_GIT_REMOTE_NAME:-deploy-$ENV_NAME}"

  if ! git -C "$PROJECT_ROOT" remote get-url "$remote_name" >/dev/null 2>&1; then
    git -C "$PROJECT_ROOT" remote add "$remote_name" "$remote_url"
  fi

  git -C "$PROJECT_ROOT" fetch "$remote_name" "$remote_branch"

  if $LIST; then
    log_step "Recent deployed commits on $remote_name/$remote_branch:"
    git -C "$PROJECT_ROOT" log --oneline -n 20 "$remote_name/$remote_branch"
    return 0
  fi

  local target
  if [[ -z "$TO" ]]; then
    target="$(git -C "$PROJECT_ROOT" rev-parse "$remote_name/$remote_branch~1")"
  else
    target="$TO"
  fi

  banner "Rolling back $ENV_NAME (git) → $target"
  log_warn "This will force-push to $remote_name/$remote_branch."
  log_event "rollback_start" "env=$ENV_NAME to=$target method=git"

  git -C "$PROJECT_ROOT" push --force-with-lease "$remote_name" "$target:refs/heads/$remote_branch"

  log_ok "Rollback complete: $remote_name/$remote_branch → $target"
  log_event "rollback_ok" "env=$ENV_NAME to=$target method=git"
}

case "$METHOD" in
  ssh) rollback_ssh ;;
  git) rollback_git ;;
  *)   log_error "Unsupported rollback method: $METHOD"; exit 2 ;;
esac
