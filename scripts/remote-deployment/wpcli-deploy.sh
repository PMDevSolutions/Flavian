#!/usr/bin/env bash
# Remote WP-CLI orchestration after a deployment.
#
# Runs activation, cache flush, and database update commands against the
# remote WordPress install. Uses WP-CLI's native --ssh alias support so the
# CLI doesn't need to be installed locally on the deployer beyond `wp`.
#
# Usage:
#   wpcli-deploy.sh --env <name> [--theme <slug>] [--plugin <slug> ...]
#                   [--skip-cache-flush] [--skip-db-update]
#
# Required config keys:
#   WP_CLI_SSH        — e.g. user@host:port/path (WP-CLI alias format)
#   WP_CLI_PATH       — absolute path to WordPress install on remote
#   WP_CLI_BIN        — wp-cli binary on remote (default: wp)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/config-loader.sh"

ENV_NAME=""
THEME_SLUG=""
PLUGIN_SLUGS=()
SKIP_CACHE=false
SKIP_DB=false

usage() {
  cat <<EOF
Usage: $(basename "$0") --env <name> [--theme SLUG] [--plugin SLUG ...]
                                      [--skip-cache-flush] [--skip-db-update]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_NAME="$2"; shift 2 ;;
    --theme) THEME_SLUG="$2"; shift 2 ;;
    --plugin) PLUGIN_SLUGS+=("$2"); shift 2 ;;
    --skip-cache-flush) SKIP_CACHE=true; shift ;;
    --skip-db-update) SKIP_DB=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) log_error "Unknown argument: $1"; usage; exit 2 ;;
  esac
done

[[ -n "$ENV_NAME" ]] || { log_error "--env is required"; exit 2; }

require_cmd wp || { log_error "wp-cli not found locally — install from https://wp-cli.org"; exit 2; }
load_environment_config "$ENV_NAME"

WP_SSH="$(require_cfg WP_CLI_SSH)" || exit 1
WP_PATH="$(require_cfg WP_CLI_PATH)" || exit 1

WP_FLAGS=(--ssh="$WP_SSH" --path="$WP_PATH")

banner "Remote WP-CLI orchestration ($ENV_NAME)"
log_event "wpcli_start" "env=$ENV_NAME ssh=$WP_SSH"

run_wp() {
  log_step "wp $*"
  wp "${WP_FLAGS[@]}" "$@"
}

# Sanity check the connection before mutating anything
log_step "Checking WP-CLI connectivity"
if ! wp "${WP_FLAGS[@]}" core is-installed >/dev/null 2>&1; then
  log_error "WP-CLI cannot reach $WP_SSH or WordPress is not installed at $WP_PATH"
  log_event "wpcli_failed" "reason=no_connection env=$ENV_NAME"
  exit 1
fi

if [[ -n "$THEME_SLUG" ]]; then
  run_wp theme activate "$THEME_SLUG"
fi

for plugin in "${PLUGIN_SLUGS[@]}"; do
  run_wp plugin activate "$plugin"
done

if ! $SKIP_DB; then
  run_wp core update-db
fi

if ! $SKIP_CACHE; then
  # cache flush is a no-op when no object cache is configured; harmless
  run_wp cache flush || true
  run_wp rewrite flush --hard || true
fi

log_ok "Remote WP-CLI orchestration complete"
log_event "wpcli_ok" "env=$ENV_NAME"
