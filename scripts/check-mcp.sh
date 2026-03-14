#!/usr/bin/env bash
#
# MCP Server Validation Script
# Checks all MCP servers configured in .mcp.json
#
# Usage: ./scripts/check-mcp.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more critical failures
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MCP_CONFIG="$PROJECT_ROOT/.mcp.json"

# MCP Server URLs
FIGMA_DESKTOP_URL="http://127.0.0.1:3845/mcp"
FIGMA_REMOTE_URL="https://mcp.figma.com/mcp"

# Timeouts
CURL_TIMEOUT=5
CONNECT_TIMEOUT=3

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# =============================================================================
# Color Output
# =============================================================================

# Check if terminal supports colors
if [[ -t 1 ]] && [[ -n "${TERM:-}" ]] && command -v tput &>/dev/null; then
    RED=$(tput setaf 1)
    GREEN=$(tput setaf 2)
    YELLOW=$(tput setaf 3)
    BLUE=$(tput setaf 4)
    BOLD=$(tput bold)
    RESET=$(tput sgr0)
else
    RED=""
    GREEN=""
    YELLOW=""
    BLUE=""
    BOLD=""
    RESET=""
fi

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo "${BOLD}====================================${RESET}"
    echo "${BOLD}$1${RESET}"
    echo "${BOLD}====================================${RESET}"
    echo ""
}

print_section() {
    echo ""
    echo "${BLUE}--- $1 ---${RESET}"
}

pass() {
    echo "${GREEN}[PASS]${RESET} $1"
    ((PASS_COUNT++))
}

fail() {
    echo "${RED}[FAIL]${RESET} $1"
    ((FAIL_COUNT++))
}

warn() {
    echo "${YELLOW}[WARN]${RESET} $1"
    ((WARN_COUNT++))
}

info() {
    echo "${BLUE}[INFO]${RESET} $1"
}

# Check if a command exists
command_exists() {
    command -v "$1" &>/dev/null
}

# =============================================================================
# Validation Functions
# =============================================================================

check_mcp_json() {
    print_section "Checking .mcp.json configuration"

    # Check if file exists
    if [[ ! -f "$MCP_CONFIG" ]]; then
        fail ".mcp.json not found at $MCP_CONFIG"
        echo "      Fix: Create .mcp.json with MCP server configurations"
        return 1
    fi

    pass ".mcp.json exists"

    # Check JSON syntax
    if command_exists python3; then
        if python3 -m json.tool "$MCP_CONFIG" >/dev/null 2>&1; then
            pass ".mcp.json is valid JSON"
        else
            fail ".mcp.json has invalid JSON syntax"
            echo "      Fix: Run 'python3 -m json.tool $MCP_CONFIG' to see error"
            return 1
        fi
    elif command_exists python; then
        if python -m json.tool "$MCP_CONFIG" >/dev/null 2>&1; then
            pass ".mcp.json is valid JSON"
        else
            fail ".mcp.json has invalid JSON syntax"
            return 1
        fi
    else
        warn "Python not found - skipping JSON syntax validation"
    fi

    # Check for required servers
    if grep -q '"figma-desktop"' "$MCP_CONFIG" 2>/dev/null; then
        pass "figma-desktop server configured"
    else
        warn "figma-desktop server not found in .mcp.json"
    fi

    if grep -q '"figma"' "$MCP_CONFIG" 2>/dev/null; then
        pass "figma (remote) server configured"
    else
        warn "figma (remote) server not found in .mcp.json"
    fi

    if grep -q '"playwright"' "$MCP_CONFIG" 2>/dev/null; then
        pass "playwright server configured"
    else
        warn "playwright server not found in .mcp.json"
    fi

    return 0
}

check_figma_desktop() {
    print_section "Checking Figma Desktop MCP ($FIGMA_DESKTOP_URL)"

    if ! command_exists curl; then
        warn "curl not found - skipping Figma Desktop MCP check"
        echo "      Install curl to enable this check"
        return 0
    fi

    # Try to connect
    local response
    local http_code

    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        --connect-timeout "$CONNECT_TIMEOUT" \
        --max-time "$CURL_TIMEOUT" \
        "$FIGMA_DESKTOP_URL" 2>/dev/null) || http_code="000"

    case "$http_code" in
        "200"|"201"|"204")
            pass "Figma Desktop MCP is responding (HTTP $http_code)"
            ;;
        "000")
            fail "Figma Desktop MCP is not reachable"
            echo "      Possible causes:"
            echo "        - Figma Desktop is not open"
            echo "        - Dev Mode is not enabled"
            echo "        - MCP server failed to start"
            echo "      Fix: Open Figma Desktop, enable Dev Mode (</>), try again"
            ;;
        "401"|"403")
            warn "Figma Desktop MCP returned auth error (HTTP $http_code)"
            echo "      The server is running but returned an auth error"
            ;;
        *)
            warn "Figma Desktop MCP returned unexpected status (HTTP $http_code)"
            ;;
    esac

    return 0
}

check_figma_remote() {
    print_section "Checking Figma Remote MCP ($FIGMA_REMOTE_URL)"

    if ! command_exists curl; then
        warn "curl not found - skipping Figma Remote MCP check"
        return 0
    fi

    # Try to connect (just checking reachability, not auth)
    local http_code

    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        --connect-timeout "$CONNECT_TIMEOUT" \
        --max-time "$CURL_TIMEOUT" \
        "$FIGMA_REMOTE_URL" 2>/dev/null) || http_code="000"

    case "$http_code" in
        "200"|"201"|"204"|"301"|"302")
            pass "Figma Remote MCP is reachable (HTTP $http_code)"
            ;;
        "401"|"403")
            pass "Figma Remote MCP is reachable (requires authentication)"
            info "Authentication is handled by Claude Code at runtime"
            ;;
        "000")
            fail "Figma Remote MCP is not reachable"
            echo "      Possible causes:"
            echo "        - No internet connection"
            echo "        - DNS resolution failed"
            echo "        - Firewall blocking mcp.figma.com"
            echo "      Fix: Check internet connection, try 'ping figma.com'"
            ;;
        *)
            warn "Figma Remote MCP returned unexpected status (HTTP $http_code)"
            ;;
    esac

    return 0
}

check_playwright() {
    print_section "Checking Playwright MCP"

    # Check Node.js
    if ! command_exists node; then
        fail "Node.js is not installed"
        echo "      Fix: Install Node.js 18+ from https://nodejs.org/"
        return 1
    fi

    local node_version
    node_version=$(node -v 2>/dev/null | sed 's/v//')
    local major_version
    major_version=$(echo "$node_version" | cut -d. -f1)

    if [[ "$major_version" -ge 18 ]]; then
        pass "Node.js version $node_version (18+ required)"
    else
        fail "Node.js version $node_version is too old (18+ required)"
        echo "      Fix: Update Node.js to version 18 or higher"
        return 1
    fi

    # Check npx
    if ! command_exists npx; then
        fail "npx is not available"
        echo "      Fix: npx should come with Node.js, try reinstalling Node.js"
        return 1
    fi

    pass "npx is available"

    # Check Playwright MCP package
    if npx @playwright/mcp@latest --help >/dev/null 2>&1; then
        pass "Playwright MCP package is available"
    else
        warn "Playwright MCP package check inconclusive"
        echo "      Package will be downloaded on first use"
    fi

    # Check Playwright browsers
    print_section "Checking Playwright browsers"

    local browsers_found=0

    # Check Chromium
    if npx playwright install --dry-run chromium 2>&1 | grep -q "already installed"; then
        pass "Chromium browser is installed"
        ((browsers_found++))
    elif npx playwright show-browsers 2>/dev/null | grep -qi "chromium"; then
        pass "Chromium browser is installed"
        ((browsers_found++))
    else
        warn "Chromium browser may not be installed"
        echo "      Fix: Run 'npx playwright install chromium'"
    fi

    # Check Firefox
    if npx playwright install --dry-run firefox 2>&1 | grep -q "already installed"; then
        pass "Firefox browser is installed"
        ((browsers_found++))
    elif npx playwright show-browsers 2>/dev/null | grep -qi "firefox"; then
        pass "Firefox browser is installed"
        ((browsers_found++))
    else
        warn "Firefox browser may not be installed"
        echo "      Fix: Run 'npx playwright install firefox'"
    fi

    # Check WebKit
    if npx playwright install --dry-run webkit 2>&1 | grep -q "already installed"; then
        pass "WebKit browser is installed"
        ((browsers_found++))
    elif npx playwright show-browsers 2>/dev/null | grep -qi "webkit"; then
        pass "WebKit browser is installed"
        ((browsers_found++))
    else
        warn "WebKit browser may not be installed"
        echo "      Fix: Run 'npx playwright install webkit'"
    fi

    if [[ "$browsers_found" -eq 0 ]]; then
        warn "No Playwright browsers detected (checks may be inconclusive)"
        echo "      Fix: Run './scripts/setup-playwright.sh' to install all browsers"
    fi

    return 0
}

check_optional_mcps() {
    print_section "Checking optional MCP servers"

    # Chrome DevTools (not currently configured)
    if grep -q '"chrome-devtools"' "$MCP_CONFIG" 2>/dev/null; then
        info "Chrome DevTools MCP is configured"

        # Check if Chrome debug port is available
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" \
            --connect-timeout "$CONNECT_TIMEOUT" \
            "http://localhost:9222/json" 2>/dev/null) || http_code="000"

        if [[ "$http_code" == "200" ]]; then
            pass "Chrome DevTools is accessible"
        else
            warn "Chrome DevTools not running (start Chrome with --remote-debugging-port=9222)"
        fi
    else
        info "Chrome DevTools MCP is not configured (optional)"
    fi

    # Core Memory (not currently configured)
    if grep -q '"core-memory"' "$MCP_CONFIG" 2>/dev/null; then
        info "Core Memory MCP is configured"
        # Add connectivity check when implemented
    else
        info "Core Memory MCP is not configured (optional)"
    fi
}

print_summary() {
    print_header "Summary"

    echo "Results:"
    echo "  ${GREEN}Passed:${RESET}   $PASS_COUNT"
    echo "  ${RED}Failed:${RESET}   $FAIL_COUNT"
    echo "  ${YELLOW}Warnings:${RESET} $WARN_COUNT"
    echo ""

    if [[ "$FAIL_COUNT" -gt 0 ]]; then
        echo "${RED}${BOLD}Status: SOME CHECKS FAILED${RESET}"
        echo ""
        echo "Review the failures above and follow the suggested fixes."
        echo "See docs/MCP-TROUBLESHOOTING.md for detailed troubleshooting."
        return 1
    elif [[ "$WARN_COUNT" -gt 0 ]]; then
        echo "${YELLOW}${BOLD}Status: PASSED WITH WARNINGS${RESET}"
        echo ""
        echo "MCP servers are mostly operational. Review warnings above."
        return 0
    else
        echo "${GREEN}${BOLD}Status: ALL CHECKS PASSED${RESET}"
        echo ""
        echo "All MCP servers are operational."
        return 0
    fi
}

# =============================================================================
# Main
# =============================================================================

main() {
    print_header "MCP Server Validation"

    echo "Project: $PROJECT_ROOT"
    echo "Config:  $MCP_CONFIG"

    # Run all checks
    check_mcp_json || true
    check_figma_desktop || true
    check_figma_remote || true
    check_playwright || true
    check_optional_mcps || true

    # Print summary and return appropriate exit code
    print_summary
}

main "$@"
