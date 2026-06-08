#!/bin/bash
# WordPress Coding Standards Checker (PHP_CodeSniffer)
#
# Dual-mode:
#
#   1. Hook mode — invoked by Claude Code PostToolUse hooks with the tool-call
#      JSON piped on stdin and no CLI arguments. Lints the single edited PHP
#      file and ALWAYS exits 0 (advisory; never blocks an edit).
#
#   2. CLI / CI mode — invoked with arguments, or from an interactive shell.
#      Lints the given paths, or the whole project via ./phpcs.xml.dist when no
#      path is given.
#
#        ./scripts/wordpress/check-coding-standards.sh                 # lint project (advisory, exit 0)
#        ./scripts/wordpress/check-coding-standards.sh themes/my-theme # lint a path (advisory)
#        ./scripts/wordpress/check-coding-standards.sh --strict        # fail (non-zero) on any violation
#        ./scripts/wordpress/check-coding-standards.sh --strict --report=checkstyle | cs2pr   # CI
#
#   Flags:
#     --strict, --ci   Exit with PHPCS's status (non-zero on violations).
#   Any other argument (a path, --report=..., etc.) is passed straight to phpcs.
#   The standard, scan targets and exclusions live in ./phpcs.xml.dist.

set -uo pipefail

PHPCS_BIN="./vendor/bin/phpcs"

# --- CLI / CI mode -----------------------------------------------------------
run_cli() {
    local strict=0
    local -a phpcs_args=()

    local arg
    for arg in "$@"; do
        case "$arg" in
            --strict|--ci) strict=1 ;;
            *) phpcs_args+=("$arg") ;;
        esac
    done

    if [ ! -f "$PHPCS_BIN" ]; then
        echo "⚠️  PHPCS not installed. Run: composer install (or ./scripts/wordpress/setup-phpcs.sh)" >&2
        # A missing linter is a hard error when we're meant to gate.
        if [ "$strict" -eq 1 ]; then
            exit 2
        fi
        exit 0
    fi

    # phpcs auto-discovers ./phpcs.xml.dist (standard, <file> targets,
    # exclusions). Positional paths, if given, override the <file> defaults.
    if [ "${#phpcs_args[@]}" -gt 0 ]; then
        "$PHPCS_BIN" "${phpcs_args[@]}"
    else
        "$PHPCS_BIN"
    fi
    local status=$?

    if [ "$strict" -eq 1 ]; then
        exit "$status"
    fi
    # Advisory mode: surface issues but never block.
    exit 0
}

# --- Hook mode (Claude Code PostToolUse) -------------------------------------
run_hook() {
    local input file_path output
    input=$(cat)
    file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

    # Only check PHP files that exist.
    [[ "$file_path" =~ \.php$ ]] || exit 0
    [ -f "$file_path" ] || exit 0

    if [ ! -f "$PHPCS_BIN" ]; then
        echo "⚠️  PHPCS not installed. Run: ./scripts/wordpress/setup-phpcs.sh" >&2
        exit 0
    fi

    echo "🔍 Checking WordPress coding standards for: $file_path" >&2
    output=$("$PHPCS_BIN" "$file_path" 2>&1 || true)

    if echo "$output" | grep -q "FOUND"; then
        echo "" >&2
        echo "⚠️  WordPress Coding Standards Violations:" >&2
        echo "$output" >&2
        echo "" >&2
        echo "These are warnings and won't block the operation." >&2
        echo "Consider fixing these issues to maintain code quality." >&2
    else
        echo "✅ No coding standard violations found" >&2
    fi

    # Always exit 0 (advisory, don't block).
    exit 0
}

if [ "$#" -gt 0 ]; then
    run_cli "$@"        # explicit args → CLI / CI mode
elif [ -t 0 ]; then
    run_cli             # interactive shell, no args → advisory project lint
else
    run_hook            # piped JSON, no args → Claude Code hook
fi
