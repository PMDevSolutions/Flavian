#!/usr/bin/env bash
# SSH/SFTP deployment using rsync over ssh.
#
# Implements an atomic, capistrano-style release layout:
#
#   <remote_root>/
#     releases/
#       <release-id>/        ← fresh upload
#       <previous-id>/       ← retained for rollback
#     current -> releases/<release-id>
#
# WordPress wp-content paths (themes / plugins / mu-plugins) are switched to
# point at <remote_root>/current via symlinks the first time the script runs
# against a host (the deployer needs write access to wp-content).
#
# Usage:
#   ssh-deploy.sh --env <name> [--target theme:<name>|plugin:<name>|all]
#                 [--release-id <id>] [--keep <N>]
#
# Required config keys (DEPLOY_CFG_*):
#   SSH_HOST, SSH_USER                — connection
#   SSH_PORT                          — default 22
#   SSH_KEY                           — path to private key (optional)
#   REMOTE_ROOT                       — base directory for releases
#   WP_CONTENT_PATH                   — absolute path to wp-content on remote
#   KEEP_RELEASES                     — defaults to 5

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/config-loader.sh"

ENV_NAME=""
TARGET="all"
RELEASE_ID=""
KEEP=""

usage() {
  cat <<EOF
Usage: $(basename "$0") --env <name> [--target SPEC] [--release-id ID] [--keep N]

  --env NAME       environment config to load (staging|production|...)
  --target SPEC    theme:<name>, plugin:<name>, or 'all' (default)
  --release-id ID  override generated release id
  --keep N         number of past releases to retain (default: config or 5)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_NAME="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    --release-id) RELEASE_ID="$2"; shift 2 ;;
    --keep) KEEP="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) log_error "Unknown argument: $1"; usage; exit 2 ;;
  esac
done

[[ -n "$ENV_NAME" ]] || { log_error "--env is required"; exit 2; }

require_cmd ssh   || exit 2
require_cmd rsync || exit 2

load_environment_config "$ENV_NAME"

SSH_HOST="$(require_cfg SSH_HOST)" || exit 1
SSH_USER="$(require_cfg SSH_USER)" || exit 1
SSH_PORT="${DEPLOY_CFG_SSH_PORT:-22}"
SSH_KEY="${DEPLOY_CFG_SSH_KEY:-}"
REMOTE_ROOT="$(require_cfg REMOTE_ROOT)" || exit 1
WP_CONTENT="$(require_cfg WP_CONTENT_PATH)" || exit 1
KEEP="${KEEP:-${DEPLOY_CFG_KEEP_RELEASES:-5}}"
RELEASE_ID="${RELEASE_ID:-$(generate_release_id)}"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o BatchMode=yes -p "$SSH_PORT")
RSYNC_SSH="ssh -p $SSH_PORT -o StrictHostKeyChecking=accept-new -o BatchMode=yes"
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
  RSYNC_SSH="$RSYNC_SSH -i $SSH_KEY"
fi

remote() {
  ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" "$@"
}

banner "SSH deploy → $SSH_USER@$SSH_HOST:$REMOTE_ROOT (release $RELEASE_ID)"
log_event "ssh_deploy_start" "env=$ENV_NAME release=$RELEASE_ID host=$SSH_HOST"

# Resolve sources to upload --------------------------------------------------
declare -a SOURCES=()
case "$TARGET" in
  theme:*)
    SOURCES+=("themes/${TARGET#theme:}")
    ;;
  plugin:*)
    SOURCES+=("plugins/${TARGET#plugin:}")
    ;;
  all|"")
    [[ -d "$PROJECT_ROOT/themes" ]]  && SOURCES+=("themes")
    [[ -d "$PROJECT_ROOT/plugins" ]] && SOURCES+=("plugins")
    [[ -d "$PROJECT_ROOT/mu-plugins" ]] && SOURCES+=("mu-plugins")
    ;;
  *) log_error "Invalid --target: $TARGET"; exit 2 ;;
esac

[[ ${#SOURCES[@]} -gt 0 ]] || { log_error "Nothing to upload"; exit 1; }

# Bootstrap remote directory layout ------------------------------------------
log_step "Preparing remote release directory"
remote "mkdir -p '$REMOTE_ROOT/releases/$RELEASE_ID'"

# Standard exclusion list. Mirrors what package-theme.sh produces locally.
RSYNC_EXCLUDES=(
  --exclude='.git/'
  --exclude='.github/'
  --exclude='.DS_Store'
  --exclude='node_modules/'
  --exclude='vendor/'
  --exclude='tests/'
  --exclude='*.test.php'
  --exclude='.env'
  --exclude='.env.*'
  --exclude='*.log'
  --exclude='__pycache__/'
)

# Upload each source preserving relative path under wp-content layout --------
for src in "${SOURCES[@]}"; do
  [[ -d "$PROJECT_ROOT/$src" ]] || { log_warn "Skipping missing source: $src"; continue; }
  log_step "Uploading $src"
  rsync -az --delete \
    --rsh="$RSYNC_SSH" \
    "${RSYNC_EXCLUDES[@]}" \
    "$PROJECT_ROOT/$src/" \
    "$SSH_USER@$SSH_HOST:$REMOTE_ROOT/releases/$RELEASE_ID/$src/"
done

# Switch the 'current' symlink atomically ------------------------------------
log_step "Switching current → $RELEASE_ID"
remote "ln -sfn '$REMOTE_ROOT/releases/$RELEASE_ID' '$REMOTE_ROOT/current.new' && \
        mv -Tf '$REMOTE_ROOT/current.new' '$REMOTE_ROOT/current'"

# Wire wp-content/{themes,plugins,mu-plugins} into the current release -------
log_step "Linking wp-content to current release"
for src in "${SOURCES[@]}"; do
  remote "if [ -e '$WP_CONTENT/$src' ] && [ ! -L '$WP_CONTENT/$src' ]; then \
            mv '$WP_CONTENT/$src' '$WP_CONTENT/${src}.pre-deploy-$(date -u +%Y%m%dT%H%M%SZ)'; \
          fi; \
          ln -sfn '$REMOTE_ROOT/current/$src' '$WP_CONTENT/$src.new' && \
          mv -Tf '$WP_CONTENT/$src.new' '$WP_CONTENT/$src'"
done

# Trim old releases ----------------------------------------------------------
log_step "Pruning old releases (keep=$KEEP)"
remote "cd '$REMOTE_ROOT/releases' && ls -1t | tail -n +$((KEEP + 1)) | xargs -I{} rm -rf -- {}"

log_ok "SSH deploy complete: release=$RELEASE_ID"
log_event "ssh_deploy_ok" "env=$ENV_NAME release=$RELEASE_ID"
printf '%s\n' "$RELEASE_ID"
