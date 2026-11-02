#!/usr/bin/env bash
# post-bash-reminders.sh <case> — PostToolUse hook (matcher: Bash), registered
# once per case with an `if:` filter so it only starts for the commands it
# reads. The argument names the reminder, so one registration never emits two:
#
#   build-qa   after validate-theme / check-coding-standards / phpcs reports a
#              pass → run the full quality gate before calling the work done
#   coverage   after a phpunit or pest run that printed coverage → check it
#              against the 80% target
#   dark-mode  after a visual-diff.js run that passed → run the dark-mode check
#   mutation   after a phpunit or pest run where every test passed → consider
#              a mutation run (Infection) to check the tests catch real faults
#
# These replace the inline $TOOL_INPUT/$TOOL_OUTPUT hooks that never fired.
# Input: the hook event as JSON on stdin. Output: JSON on stdout, or nothing.
# Always exits 0.
set -u
trap 'exit 0' ERR

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/hook-io.sh
source "$HOOK_DIR/lib/hook-io.sh"
# shellcheck source=lib/flavian-helpers.sh
source "$HOOK_DIR/lib/flavian-helpers.sh"

CASE="${1:-}"
[ -n "$CASE" ] || exit 0

hook_read_input
hook_read_context

[ "$TOOL_NAME" = "Bash" ] || exit 0
[ -n "$TOOL_COMMAND" ] || exit 0

cmd_matches() { printf '%s' "$TOOL_COMMAND" | grep -Eq "$1"; }
OUTPUT="$(flavian_bash_output)"
out_matches() { printf '%s' "$OUTPUT" | grep -Eq "$1"; }
out_matches_i() { printf '%s' "$OUTPUT" | grep -Eiq "$1"; }

case "$CASE" in
  build-qa)
    cmd_matches '(^|[[:space:]/])(check-coding-standards\.sh|validate-theme(-e2e)?\.sh|phpcs)([[:space:]]|$)' || exit 0
    out_matches_i 'pass|success|no (errors|violations)' || exit 0
    hook_additional_context PostToolUse "[post-build-qa] Theme validation passed. Run the full quality gate before calling this done: ./scripts/wordpress/check-coding-standards.sh <path> && ./scripts/wordpress/security-scan.sh <path> && ./scripts/wordpress/check-performance.sh <path>." ;;
  coverage)
    cmd_matches 'phpunit|pest' || exit 0
    out_matches_i 'coverage|clover' || exit 0
    hook_additional_context PostToolUse "[coverage-check] Review the coverage output above against the 80% target for theme and plugin code; cover the reported lines before the quality gate." ;;
  dark-mode)
    cmd_matches 'visual-diff' || exit 0
    out_matches 'PASS' || exit 0
    out_matches 'FAIL' && exit 0
    hook_additional_context PostToolUse "[dark-mode-reminder] Visual diff passed. Check the dark theme too: ./scripts/check-dark-mode.sh <url>." ;;
  mutation)
    cmd_matches 'phpunit|pest' || exit 0
    out_matches 'OK \(|Tests:[[:space:]]+[0-9]+ passed|All tests passed' || exit 0
    out_matches 'FAILURES|ERRORS|[0-9]+ failed' && exit 0
    hook_additional_context PostToolUse "[mutation-test] All tests passed. Consider a mutation run to check the tests catch real faults: vendor/bin/infection --min-msi=70 --min-covered-msi=80." ;;
  *) exit 0 ;;
esac
exit 0
