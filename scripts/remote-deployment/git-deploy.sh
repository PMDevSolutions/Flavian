#!/usr/bin/env bash
# Git-based deployment.
#
# Pushes the current branch (or a named ref) to a remote bare repo. The remote
# is expected to have a post-receive hook that updates the deployment checkout
# — this is the standard "git push to deploy" model used by hosts like Pantheon,
# WP Engine, and many bespoke setups.
#
# Usage:
#   git-deploy.sh --env <name> [--ref <git-ref>]
#
# Required config keys:
#   GIT_REMOTE_URL     — e.g. ssh://deploy@host/var/git/site.git
#   GIT_REMOTE_BRANCH  — e.g. main, production
#   GIT_REMOTE_NAME    — local remote alias (default: deploy-<env>)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/config-loader.sh"

ENV_NAME=""
REF="HEAD"

usage() {
  cat <<EOF
Usage: $(basename "$0") --env <name> [--ref <git-ref>]

  --env NAME    environment config to load
  --ref REF     local ref to push (default: HEAD)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_NAME="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) log_error "Unknown argument: $1"; usage; exit 2 ;;
  esac
done

[[ -n "$ENV_NAME" ]] || { log_error "--env is required"; exit 2; }

require_cmd git || exit 2
load_environment_config "$ENV_NAME"

REMOTE_URL="$(require_cfg GIT_REMOTE_URL)" || exit 1
REMOTE_BRANCH="$(require_cfg GIT_REMOTE_BRANCH)" || exit 1
REMOTE_NAME="${DEPLOY_CFG_GIT_REMOTE_NAME:-deploy-$ENV_NAME}"

banner "Git deploy → $REMOTE_URL ($REMOTE_BRANCH)"
log_event "git_deploy_start" "env=$ENV_NAME remote=$REMOTE_URL branch=$REMOTE_BRANCH"

# Configure or refresh the remote alias --------------------------------------
if git -C "$PROJECT_ROOT" remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  log_step "Updating remote '$REMOTE_NAME'"
  git -C "$PROJECT_ROOT" remote set-url "$REMOTE_NAME" "$REMOTE_URL"
else
  log_step "Adding remote '$REMOTE_NAME'"
  git -C "$PROJECT_ROOT" remote add "$REMOTE_NAME" "$REMOTE_URL"
fi

# Reject deploys with a dirty worktree to keep what's deployed in sync with HEAD
if [[ -n "$(git -C "$PROJECT_ROOT" status --porcelain)" ]]; then
  log_error "Working tree has uncommitted changes — commit or stash before deploying"
  log_event "git_deploy_failed" "reason=dirty_worktree env=$ENV_NAME"
  exit 1
fi

LOCAL_SHA="$(git -C "$PROJECT_ROOT" rev-parse "$REF")"
log_info "Deploying $REF ($LOCAL_SHA) → $REMOTE_NAME/$REMOTE_BRANCH"

log_step "Pushing to remote"
git -C "$PROJECT_ROOT" push --atomic "$REMOTE_NAME" "$REF:refs/heads/$REMOTE_BRANCH"

log_ok "Git deploy complete: $LOCAL_SHA"
log_event "git_deploy_ok" "env=$ENV_NAME sha=$LOCAL_SHA"
printf '%s\n' "$LOCAL_SHA"
