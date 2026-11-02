#!/usr/bin/env bash
# agent-no-deploy.sh — PreToolUse hook (matcher: Bash), declared in the
# frontmatter of the agents whose domain touches deploys (deployment-agent,
# devops-automator).
#
# Subagents build, test and stage. They never deploy, roll back, write to a
# remote host or destroy local data: those steps belong to the main session,
# behind the deploy guard's human prompt. This script runs deploy-guard.sh in
# subagent mode, where each of them is a deny with a reason the agent can act on.
#
# The settings-level registration of deploy-guard.sh already denies the same
# commands in every subagent (it reads agent_id from the event), and that is
# the half that holds in a plugin install, where agent frontmatter hooks are
# ignored. This hook keeps the rule attached to the agent file when the file is
# copied into another repo.
#
# Input: the hook event as JSON on stdin. Output: JSON on stdout, or nothing.
# Always exits 0.
set -u
trap 'exit 0' ERR

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HOOK_DIR/deploy-guard.sh" ] || exit 0
exec bash "$HOOK_DIR/deploy-guard.sh" --subagent
