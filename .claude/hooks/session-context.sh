#!/usr/bin/env bash
# session-context.sh — SessionStart hook (matcher: startup|resume|clear|compact).
#
# Adds a short, current status block to the session's context: conversion
# runs in flight (.claude/pipeline/<theme>/state.json), the themes under
# themes/, whether the Docker stack is running and .env exists, the branch
# and uncommitted work under themes/, plugins/ and mu-plugins/, anything
# tracked under wp-content/ (a layout violation), and the hooks that are
# active. Plain text on stdout is added to context for SessionStart hooks.
# Silent outside a Flavian checkout and on any failure; always exits 0.
set -u
trap 'exit 0' ERR

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/hook-io.sh
source "$HOOK_DIR/lib/hook-io.sh"
# shellcheck source=lib/flavian-helpers.sh
source "$HOOK_DIR/lib/flavian-helpers.sh"

hook_read_input
command -v node >/dev/null 2>&1 || exit 0

PROJECT="$(hook_project_dir)"
flavian_is_flavian_checkout "$PROJECT" || exit 0

node "$HOOK_DIR/lib/session-context.mjs" "$PROJECT" 2>/dev/null || true
exit 0
