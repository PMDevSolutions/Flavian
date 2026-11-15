#!/usr/bin/env bash
# Remote deployment orchestrator.
#
# This is the entry point used by the deployment-agent and humans alike. It
# loads an environment config, runs pre-deployment checks, dispatches the
# requested deploy method, optionally runs remote WP-CLI orchestration, and
# fans out notifications. On failure it can trigger an automatic rollback
# when the config asks for it.
#
# Usage:
#   deploy.sh --env <name> [--method ssh|git|wpcli] [--target SPEC]
#             [--ref REF] [--dry-run] [--skip-checks] [--auto-rollback]
#             [--release-id ID] [--actor NAME] [--message TEXT]
#
#   --env NAME       required. environment config from .claude/config/deployment/
#   --method MODE    overrides DEPLOY_CFG_METHOD (ssh, git, wpcli)
#   --target SPEC    theme:<slug>, plugin:<slug>, or all (ssh method only)
#   --ref REF        git ref to push (git method only; default HEAD)
#   --dry-run        print plan without executing
#   --skip-checks    skip pre-deployment validation (NOT recommended)
#   --auto-rollback  on failure, automatically restore previous release
#
# Exit codes:
#   0 — success
#   1 — deployment failed (rollback may have run)
#   2 — invocation error

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/config-loader.sh"

ENV_NAME=""
METHOD=""
TARGET="all"
REF="HEAD"
DRY_RUN=false
SKIP_CHECKS=false
AUTO_ROLLBACK=false
RELEASE_ID=""
ACTOR="${USER:-unknown}"
MESSAGE=""

usage() {
  sed -n '4,22p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_NAME="$2"; shift 2 ;;
    --method) METHOD="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --skip-checks) SKIP_CHECKS=true; shift ;;
    --auto-rollback) AUTO_ROLLBACK=true; shift ;;
    --release-id) RELEASE_ID="$2"; shift 2 ;;
    --actor) ACTOR="$2"; shift 2 ;;
    --message) MESSAGE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) log_error "Unknown argument: $1"; usage; exit 2 ;;
  esac
done

[[ -n "$ENV_NAME" ]] || { log_error "--env is required"; exit 2; }

load_environment_config "$ENV_NAME"
METHOD="${METHOD:-${DEPLOY_CFG_METHOD:-ssh}}"
RELEASE_ID="${RELEASE_ID:-$(generate_release_id)}"
export DEPLOY_RELEASE_ID="$RELEASE_ID"
export DEPLOY_ACTOR="$ACTOR"

# Production safety: refuse deploys from a non-clean tree unless explicitly
# overridden by the config. This prevents shipping uncommitted local hacks.
if [[ "$ENV_NAME" == "production" ]] && [[ "${DEPLOY_CFG_ALLOW_DIRTY:-false}" != "true" ]]; then
  if [[ -n "$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null)" ]]; then
    log_error "Refusing to deploy to production with uncommitted changes."
    log_error "Commit/stash, or set allow_dirty: true in production.yml to override."
    exit 1
  fi
fi

banner "Deploy → $ENV_NAME (method=$METHOD, target=$TARGET, release=$RELEASE_ID)"
log_event "deploy_plan" "env=$ENV_NAME method=$METHOD target=$TARGET release=$RELEASE_ID actor=$ACTOR"

if $DRY_RUN; then
  cat <<EOF
[DRY RUN]
  environment   : $ENV_NAME
  config file   : ${DEPLOY_CFG_SOURCE_FILE:-}
  method        : $METHOD
  target        : $TARGET
  ref           : $REF (git only)
  release id    : $RELEASE_ID
  log file      : $DEPLOY_LOG_FILE
  actor         : $ACTOR
  pre-checks    : $($SKIP_CHECKS && echo skipped || echo enabled)
  auto-rollback : $AUTO_ROLLBACK
EOF
  log_event "deploy_dry_run_complete" "env=$ENV_NAME"
  exit 0
fi

# Notify-on-start ------------------------------------------------------------
"$SCRIPT_DIR/notify.sh" --env "$ENV_NAME" --status started \
  --release-id "$RELEASE_ID" --actor "$ACTOR" \
  --message "${MESSAGE:-Deployment in progress}" || true

# 1. Pre-deployment checks ---------------------------------------------------
if ! $SKIP_CHECKS; then
  log_step "Running pre-deployment checks"
  if ! "$SCRIPT_DIR/pre-deploy-checks.sh" --target "$TARGET"; then
    log_error "Pre-deployment checks failed — aborting"
    "$SCRIPT_DIR/notify.sh" --env "$ENV_NAME" --status failed \
      --release-id "$RELEASE_ID" --actor "$ACTOR" \
      --message "Pre-deployment checks failed" || true
    exit 1
  fi
else
  log_warn "Skipping pre-deployment checks (--skip-checks)"
fi

# 2. Dispatch primary deploy method ------------------------------------------
deploy_failed=0
case "$METHOD" in
  ssh)
    "$SCRIPT_DIR/ssh-deploy.sh" --env "$ENV_NAME" --target "$TARGET" \
      --release-id "$RELEASE_ID" || deploy_failed=$?
    ;;
  git)
    "$SCRIPT_DIR/git-deploy.sh" --env "$ENV_NAME" --ref "$REF" || deploy_failed=$?
    ;;
  wpcli)
    "$SCRIPT_DIR/wpcli-deploy.sh" --env "$ENV_NAME" \
      ${DEPLOY_CFG_ACTIVATE_THEME:+--theme "$DEPLOY_CFG_ACTIVATE_THEME"} \
      || deploy_failed=$?
    ;;
  *)
    log_error "Unsupported method: $METHOD"
    exit 2
    ;;
esac

if [[ $deploy_failed -ne 0 ]]; then
  log_error "Primary deploy step failed (exit $deploy_failed)"
  if $AUTO_ROLLBACK; then
    log_warn "Triggering automatic rollback"
    "$SCRIPT_DIR/rollback.sh" --env "$ENV_NAME" --method "$METHOD" || true
    "$SCRIPT_DIR/notify.sh" --env "$ENV_NAME" --status rollback \
      --release-id "$RELEASE_ID" --actor "$ACTOR" \
      --message "Auto-rollback after failed deploy" || true
  fi
  "$SCRIPT_DIR/notify.sh" --env "$ENV_NAME" --status failed \
    --release-id "$RELEASE_ID" --actor "$ACTOR" \
    --message "${MESSAGE:-Deploy failed at $METHOD step}" || true
  exit 1
fi

# 3. Optional remote WP-CLI orchestration ------------------------------------
# Only run when the SSH/Git method was used AND the config provides WP-CLI
# settings. If the user explicitly chose --method wpcli, that ran above.
if [[ "$METHOD" != "wpcli" && -n "${DEPLOY_CFG_WP_CLI_SSH:-}" ]]; then
  log_step "Running post-deploy WP-CLI orchestration"
  wp_args=(--env "$ENV_NAME")
  [[ -n "${DEPLOY_CFG_ACTIVATE_THEME:-}" ]] && wp_args+=(--theme "$DEPLOY_CFG_ACTIVATE_THEME")
  if [[ -n "${DEPLOY_CFG_ACTIVATE_PLUGINS:-}" ]]; then
    IFS=',' read -ra plist <<< "$DEPLOY_CFG_ACTIVATE_PLUGINS"
    for p in "${plist[@]}"; do wp_args+=(--plugin "$p"); done
  fi
  if ! "$SCRIPT_DIR/wpcli-deploy.sh" "${wp_args[@]}"; then
    log_error "Post-deploy WP-CLI orchestration failed"
    if $AUTO_ROLLBACK; then
      "$SCRIPT_DIR/rollback.sh" --env "$ENV_NAME" --method "$METHOD" || true
      "$SCRIPT_DIR/notify.sh" --env "$ENV_NAME" --status rollback \
        --release-id "$RELEASE_ID" --actor "$ACTOR" \
        --message "Auto-rollback after WP-CLI failure" || true
    fi
    "$SCRIPT_DIR/notify.sh" --env "$ENV_NAME" --status failed \
      --release-id "$RELEASE_ID" --actor "$ACTOR" \
      --message "WP-CLI post-deploy step failed" || true
    exit 1
  fi
fi

# 4. Success --------------------------------------------------------------------
log_ok "Deployment complete: $ENV_NAME release=$RELEASE_ID"
log_event "deploy_ok" "env=$ENV_NAME release=$RELEASE_ID method=$METHOD"

"$SCRIPT_DIR/notify.sh" --env "$ENV_NAME" --status success \
  --release-id "$RELEASE_ID" --actor "$ACTOR" \
  --message "${MESSAGE:-Deploy successful}" || true

log_info "Log: $DEPLOY_LOG_FILE"
