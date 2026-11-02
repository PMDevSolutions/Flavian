#!/usr/bin/env bash
# deploy-guard.sh — PreToolUse hook (matcher: Bash). Registered in
# .claude/settings.json for every session with onFailure "block", mirrored in
# .claude/hooks/hooks.json for plugin installs, and run in subagent mode by
# agent-no-deploy.sh from the frontmatter of the agents that deploy.
#
# Flavian ships WordPress themes and plugins to remote hosts through
# scripts/remote-deployment/ (SSH/SFTP atomic releases, git push-to-deploy,
# remote WP-CLI) and runs a local Docker stack whose database is not in git.
# Each of these is hard to undo, so this hook stops them for a human:
#
#   gate     deploy.sh --env production (without --dry-run), rollback.sh for
#            any environment (without --list), wp --ssh=, ssh/sftp to a host
#            unless the remote command is read-only, rsync/scp whose
#            destination is remote
#            → permissionDecision "ask". In bypassPermissions and dontAsk,
#              where a hook cannot prompt, the answer is "deny" with where to
#              run the command instead (lib/hook-io.sh → hook_gate_decision).
#   local    docker compose down -v/--volumes, docker volume rm/prune,
#            docker system prune, wp db reset/drop/clean, wp site empty
#            → "ask" the same way: they destroy local development data.
#   preview  deploy.sh to any other environment → a reminder to dry-run first.
#   silent   --dry-run, --list, pre-deploy-checks.sh, read-only ssh
#            inspection, rsync/scp pulls, docker up/down/ps, everything else.
#
# Inside a SUBAGENT (the event carries agent_id, or --subagent is passed) every
# gated tier is a deny: subagents build, test and stage, and the main session
# ships. This settings-level check is the half that holds when the agents run
# from the plugin, because plugin agents ignore frontmatter hooks.
#
# Input: the hook event as JSON on stdin. Output: JSON on stdout, or nothing.
# Always exits 0.
set -u
trap 'exit 0' ERR

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/hook-io.sh
source "$HOOK_DIR/lib/hook-io.sh"

IN_SUBAGENT=0
[ "${1:-}" = "--subagent" ] && IN_SUBAGENT=1

hook_read_input
hook_read_context

[ "$TOOL_NAME" = "Bash" ] || exit 0
[ -n "$TOOL_COMMAND" ] || exit 0
[ -n "$HOOK_AGENT_ID" ] && IN_SUBAGENT=1

# Text that only mentions a command must not trip the guard: drop heredoc
# bodies (a doc written with cat <<EOF) and quoted commit messages (-m "...")
# before classifying. A gated command after a heredoc is still seen.
strip_literals() {
  awk '
    BEGIN { skip = 0 }
    skip == 1 { if ($0 == term || $0 ~ ("^[[:space:]]*" term "$")) skip = 0; next }
    {
      line = $0
      if (match(line, /<<-?[[:space:]]*["'"'"']?[A-Za-z_][A-Za-z0-9_]*["'"'"']?/)) {
        term = substr(line, RSTART, RLENGTH)
        sub(/^<<-?[[:space:]]*/, "", term)
        gsub(/["'"'"']/, "", term)
        skip = 1
      }
      print line
    }' | sed -E "s/(^|[[:space:]])-m[[:space:]]+(\"[^\"]*\"|'[^']*')/\1-m MSG/g"
}
SCAN="$(printf '%s\n' "$TOOL_COMMAND" | strip_literals 2>/dev/null || true)"
[ -n "$SCAN" ] || SCAN="$TOOL_COMMAND"

# Cheap pre-check: anything the classifier can act on names one of these.
case "$SCAN" in
  *remote-deployment*|*--ssh=*|*ssh*|*sftp*|*scp*|*rsync*|*docker*|*" db "*|*"site empty"*) ;;
  *) exit 0 ;;
esac

matches() { printf '%s' "$SCAN" | grep -Eq "$1"; }
# A program name must start a word: preceded by start, whitespace, or a shell operator.
B='(^|[[:space:];&|(`])'
READONLY_VERBS='(^|[[:space:]"'"'"'])(wp[[:space:]]+(--[^[:space:]]+[[:space:]]+)*(core[[:space:]]+(version|check-update|verify-checksums)|plugin[[:space:]]+(list|status|verify-checksums|get)|theme[[:space:]]+(list|status|get)|option[[:space:]]+get|site[[:space:]]+(list|health)|db[[:space:]]+(size|check)|user[[:space:]]+list|cron[[:space:]]+event[[:space:]]+list|config[[:space:]]+get|cli[[:space:]]+version)|cat|ls|tail|head|grep|zgrep|zcat|find|stat|df|du|wc|uptime|date|pwd|whoami|hostname|php[[:space:]]+-v)([[:space:]]|$|"|'"'"')'
WRITE_VERBS='(wp[[:space:]]+(--[^[:space:]]+[[:space:]]+)*[a-z-]+([[:space:]]+[a-z-]+)*[[:space:]]+(update|install|activate|deactivate|delete|uninstall|toggle|create|set|add|import|reset|drop|clean|empty|run|flush|regenerate|search-replace)([[:space:]]|$|"|'"'"')|[[:space:]]rm[[:space:]]|[[:space:]]mv[[:space:]]|[[:space:]]cp[[:space:]]|chmod|chown|sed[[:space:]]+-i|tee[[:space:]]|>|mkdir|touch[[:space:]]|unzip|tar[[:space:]]+-?x|git[[:space:]]+(pull|checkout|reset|push)|composer|npm[[:space:]]|pnpm[[:space:]]|crontab|rsync|systemctl|service[[:space:]])'

TIER=""
WHAT=""
ENV_NAME="$(printf '%s' "$SCAN" | sed -nE 's/.*--env[[:space:]=]+([^[:space:]]+).*/\1/p' | head -n 1 || true)"

if matches 'remote-deployment/deploy\.sh([[:space:]]|$)'; then
  if matches '(^|[[:space:]])--dry-run([[:space:]]|$)'; then
    exit 0
  elif [ "$ENV_NAME" = "production" ]; then
    TIER=gate; WHAT="scripts/remote-deployment/deploy.sh --env production ships themes and plugins to the live site"
  else
    TIER=preview; WHAT="scripts/remote-deployment/deploy.sh to the ${ENV_NAME:-named} environment changes a running site"
  fi
elif matches 'remote-deployment/rollback\.sh([[:space:]]|$)'; then
  if matches '(^|[[:space:]])--list([[:space:]]|$)'; then
    exit 0
  fi
  TIER=gate; WHAT="scripts/remote-deployment/rollback.sh swaps the ${ENV_NAME:-remote} release (and force-pushes for git deploys)"
elif matches "${B}wp[[:space:]].*--ssh="; then
  TIER=gate; WHAT="wp --ssh= runs WP-CLI on a remote host and changes the live site"
elif matches "${B}(ssh|sftp)([[:space:]]|$)"; then
  if matches "${B}ssh([[:space:]]|$)" && matches "$READONLY_VERBS" && ! matches "$WRITE_VERBS"; then
    exit 0
  fi
  TIER=gate; WHAT="ssh/sftp to a host can change the live site; only read-only inspection commands pass without asking"
elif matches "${B}(scp|rsync)([[:space:]]|$)"; then
  # A transfer whose last path argument is remote is a push to the host; a pull passes.
  LAST_PATH="$(printf '%s' "$SCAN" | tr '\n' ' ' | awk '{ for (i = 2; i <= NF; i++) if ($i !~ /^-/) last = $i; print last }' || true)"
  if printf '%s' "$LAST_PATH" | grep -Eq '^([^[:space:]@]+@)?[^[:space:]:/]+:'; then
    TIER=gate; WHAT="rsync/scp to a remote host writes files onto a live site outside the deploy pipeline"
  else
    exit 0
  fi
elif matches "${B}docker([[:space:]]+(compose|-compose))?([[:space:]]+[^[:space:]]+)*[[:space:]]+down([[:space:]]+[^[:space:]]+)*[[:space:]]+(-v|--volumes)([[:space:]]|$)"; then
  TIER=local; WHAT="docker compose down -v removes the Docker volumes, including the local WordPress database"
elif matches "${B}docker[[:space:]]+volume[[:space:]]+(rm|prune)([[:space:]]|$)"; then
  TIER=local; WHAT="docker volume rm/prune deletes Docker volumes, including the local WordPress database"
elif matches "${B}docker[[:space:]]+system[[:space:]]+prune([[:space:]]|$)"; then
  TIER=local; WHAT="docker system prune removes images, containers, networks and (with --volumes) the local database"
elif matches "${B}wp[[:space:]]+([^[:space:]]+[[:space:]]+)*db[[:space:]]+(reset|drop|clean)([[:space:]]|$)"; then
  TIER=local; WHAT="wp db reset/drop/clean empties the WordPress database"
elif matches "${B}wp[[:space:]]+([^[:space:]]+[[:space:]]+)*site[[:space:]]+empty([[:space:]]|$)"; then
  TIER=local; WHAT="wp site empty deletes every post, comment and term"
fi

[ -n "$TIER" ] || exit 0

if [ "$TIER" = "preview" ]; then
  [ "$IN_SUBAGENT" -eq 1 ] && TIER=gate
fi

if [ "$IN_SUBAGENT" -eq 1 ]; then
  hook_pretooluse_decision deny "Deploy guard (subagent): $WHAT. Subagents build, test and stage; they never deploy, roll back, write to a remote host or destroy local data. Put the exact command and what must be true first (pre-deploy checks green, a human's go-ahead) in your final report, and the main session runs it."
  exit 0
fi

case "$TIER" in
  gate)
    hook_gate_decision ask "Deploy guard: $WHAT. This reaches a live site and is hard to undo. Approve only if a human asked for this step and the pre-deploy checks passed (./scripts/remote-deployment/pre-deploy-checks.sh --target all, or deploy.sh --dry-run for the plan); otherwise deny it and hand the command back." ;;
  local)
    hook_gate_decision ask "Deploy guard: $WHAT. That data is not in git and will not come back. Approve only if a human asked for it (export first: wp db export backup.sql)." ;;
  preview)
    hook_additional_context PreToolUse "Deploy guard: $WHAT. Run it with --dry-run first and read the plan; production deploys stop for a human." ;;
esac
exit 0
