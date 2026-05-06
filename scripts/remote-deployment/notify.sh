#!/usr/bin/env bash
# Send deployment notifications to Slack, Discord, generic webhooks, and email.
#
# Usage:
#   notify.sh --env <name> --status (started|success|failed|rollback)
#             [--message "free text"] [--release-id ID] [--actor NAME]
#
# Notification targets are read from the environment config:
#   NOTIFY_SLACK_WEBHOOK
#   NOTIFY_DISCORD_WEBHOOK
#   NOTIFY_WEBHOOK_URL          (generic JSON POST)
#   NOTIFY_EMAIL_TO             (comma-separated list, requires `mail`)
#   NOTIFY_EMAIL_FROM
#
# Channels with no value configured are silently skipped, so a single config
# can target one or many integrations.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/config-loader.sh"

ENV_NAME=""
STATUS=""
MESSAGE=""
RELEASE_ID="${DEPLOY_RELEASE_ID:-}"
ACTOR="${DEPLOY_ACTOR:-${USER:-unknown}}"

usage() {
  cat <<EOF
Usage: $(basename "$0") --env NAME --status STATUS [--message TEXT]
                        [--release-id ID] [--actor NAME]

  --status   one of: started, success, failed, rollback
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_NAME="$2"; shift 2 ;;
    --status) STATUS="$2"; shift 2 ;;
    --message) MESSAGE="$2"; shift 2 ;;
    --release-id) RELEASE_ID="$2"; shift 2 ;;
    --actor) ACTOR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) log_error "Unknown argument: $1"; usage; exit 2 ;;
  esac
done

[[ -n "$ENV_NAME" && -n "$STATUS" ]] || { usage; exit 2; }

load_environment_config "$ENV_NAME"

case "$STATUS" in
  started)  EMOJI=":rocket:";        COLOUR="#3aa3e3" ;;
  success)  EMOJI=":white_check_mark:"; COLOUR="#36a64f" ;;
  failed)   EMOJI=":x:";              COLOUR="#cc0000" ;;
  rollback) EMOJI=":rewind:";         COLOUR="#dd9900" ;;
  *) log_error "Invalid --status: $STATUS"; exit 2 ;;
esac

TITLE="$EMOJI WordPress deploy [$ENV_NAME] — $STATUS"
BODY="actor: $ACTOR"
[[ -n "$RELEASE_ID" ]] && BODY="$BODY"$'\n'"release: $RELEASE_ID"
[[ -n "$MESSAGE"   ]] && BODY="$BODY"$'\n'"$MESSAGE"

log_step "Sending notifications: $TITLE"
log_event "notify" "env=$ENV_NAME status=$STATUS release=${RELEASE_ID:-none}"

post_json() {
  local url="$1" payload="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -m 10 -H 'Content-Type: application/json' -d "$payload" "$url" >/dev/null \
      || log_warn "Webhook POST failed: $url"
  else
    log_warn "curl not installed — skipping webhook"
  fi
}

# Slack ----------------------------------------------------------------------
if [[ -n "${DEPLOY_CFG_NOTIFY_SLACK_WEBHOOK:-}" ]]; then
  read -r -d '' payload <<JSON || true
{"attachments":[{"color":"$COLOUR","title":"$TITLE","text":$(printf '%s' "$BODY" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '"%s"' "${BODY//\"/\\\"}")}]}
JSON
  post_json "$DEPLOY_CFG_NOTIFY_SLACK_WEBHOOK" "$payload"
fi

# Discord --------------------------------------------------------------------
if [[ -n "${DEPLOY_CFG_NOTIFY_DISCORD_WEBHOOK:-}" ]]; then
  content="$TITLE"$'\n'"$BODY"
  payload=$(printf '{"content": %s}' "$(printf '%s' "$content" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '"%s"' "${content//\"/\\\"}")")
  post_json "$DEPLOY_CFG_NOTIFY_DISCORD_WEBHOOK" "$payload"
fi

# Generic webhook ------------------------------------------------------------
if [[ -n "${DEPLOY_CFG_NOTIFY_WEBHOOK_URL:-}" ]]; then
  payload=$(python3 -c "
import json, os
print(json.dumps({
  'environment': os.environ['ENV_NAME'],
  'status': os.environ['STATUS'],
  'release': os.environ.get('RELEASE_ID') or None,
  'actor': os.environ['ACTOR'],
  'message': os.environ.get('MESSAGE') or None,
}))" 2>/dev/null || printf '{"environment":"%s","status":"%s"}' "$ENV_NAME" "$STATUS")
  ENV_NAME="$ENV_NAME" STATUS="$STATUS" RELEASE_ID="$RELEASE_ID" ACTOR="$ACTOR" MESSAGE="$MESSAGE" \
    post_json "$DEPLOY_CFG_NOTIFY_WEBHOOK_URL" "$payload"
fi

# Email ----------------------------------------------------------------------
if [[ -n "${DEPLOY_CFG_NOTIFY_EMAIL_TO:-}" ]]; then
  if command -v mail >/dev/null 2>&1; then
    printf '%s\n' "$BODY" | mail -s "$TITLE" \
      ${DEPLOY_CFG_NOTIFY_EMAIL_FROM:+-r "$DEPLOY_CFG_NOTIFY_EMAIL_FROM"} \
      "$DEPLOY_CFG_NOTIFY_EMAIL_TO" || log_warn "mail send failed"
  else
    log_warn "mail command not installed — skipping email notification"
  fi
fi

log_ok "Notifications dispatched"
