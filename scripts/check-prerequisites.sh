#!/bin/bash
#
# Prerequisites Verification Script
# Checks all required and optional tools for using this template.
#
# Usage: ./scripts/check-prerequisites.sh
#
# Exit Codes:
#   0 - All required prerequisites met
#   1 - One or more required prerequisites missing
#   2 - Script execution error
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
REQUIRED_PASS=0
REQUIRED_FAIL=0
OPTIONAL_PASS=0
OPTIONAL_SKIP=0
SYSTEM_PASS=0
SYSTEM_FAIL=0

# Minimum versions
MIN_GIT_VERSION="2.30.0"
MIN_DOCKER_VERSION="4.0.0"
MIN_NODE_VERSION="18.0.0"
MIN_PHP_VERSION="8.1"
MIN_COMPOSER_VERSION="2.0.0"
MIN_WPCLI_VERSION="2.8.0"
MIN_GH_VERSION="2.0.0"
MIN_RAM_GB=8
MIN_DISK_GB=10

# Helper functions
print_header() {
    echo ""
    echo -e "${CYAN}$1${NC}"
    echo "$(echo "$1" | sed 's/./-/g')"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_skip() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Version comparison function
# Returns 0 if version1 >= version2
version_gte() {
    local v1="$1"
    local v2="$2"

    # Extract just numbers (handle formats like "2.43.0" or "v18.19.0")
    v1=$(echo "$v1" | sed 's/[^0-9.]//g')
    v2=$(echo "$v2" | sed 's/[^0-9.]//g')

    # Compare using sort -V
    [ "$(printf '%s\n' "$v2" "$v1" | sort -V | head -n1)" = "$v2" ]
}

# Extract version number from various formats
extract_version() {
    echo "$1" | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1
}

# Check Git
check_git() {
    if command -v git &> /dev/null; then
        local version
        version=$(git --version 2>&1 | extract_version)
        if [ -n "$version" ]; then
            if version_gte "$version" "$MIN_GIT_VERSION"; then
                print_pass "Git $version (minimum: $MIN_GIT_VERSION)"
                ((REQUIRED_PASS++))
                return 0
            else
                print_fail "Git $version (minimum: $MIN_GIT_VERSION required)"
                ((REQUIRED_FAIL++))
                return 1
            fi
        else
            print_fail "Git installed but version could not be determined"
            ((REQUIRED_FAIL++))
            return 1
        fi
    else
        print_fail "Git not installed"
        echo "       Install: https://git-scm.com/downloads"
        ((REQUIRED_FAIL++))
        return 1
    fi
}

# Check Docker
check_docker() {
    if command -v docker &> /dev/null; then
        local version
        version=$(docker --version 2>&1 | extract_version)
        if [ -n "$version" ]; then
            # Check if daemon is running
            if docker info &> /dev/null; then
                print_pass "Docker $version (daemon running)"
                ((REQUIRED_PASS++))
                return 0
            else
                print_fail "Docker $version installed but daemon not running"
                echo "       Start Docker Desktop and try again"
                ((REQUIRED_FAIL++))
                return 1
            fi
        else
            print_fail "Docker installed but version could not be determined"
            ((REQUIRED_FAIL++))
            return 1
        fi
    else
        print_fail "Docker not installed"
        echo "       Install: https://docs.docker.com/desktop/"
        ((REQUIRED_FAIL++))
        return 1
    fi
}

# Check Claude Code
check_claude() {
    if command -v claude &> /dev/null; then
        local version
        version=$(claude --version 2>&1 | extract_version)
        if [ -n "$version" ]; then
            print_pass "Claude Code $version"
        else
            print_pass "Claude Code installed"
        fi
        ((REQUIRED_PASS++))
        return 0
    else
        print_fail "Claude Code not installed"
        echo "       Install: npm install -g @anthropic-ai/claude-code"
        echo "       Or visit: https://claude.ai/code"
        ((REQUIRED_FAIL++))
        return 1
    fi
}

# Check GitHub CLI
check_gh() {
    if command -v gh &> /dev/null; then
        local version
        version=$(gh --version 2>&1 | extract_version)
        if [ -n "$version" ]; then
            # Check authentication
            if gh auth status &> /dev/null; then
                local user
                user=$(gh auth status 2>&1 | grep -oP 'Logged in to github.com account \K\w+' || gh auth status 2>&1 | grep -oP 'account \K\w+' || echo "authenticated")
                print_pass "GitHub CLI $version (logged in as $user)"
            else
                print_pass "GitHub CLI $version (not authenticated)"
                echo "       Run 'gh auth login' to authenticate"
            fi
            ((OPTIONAL_PASS++))
            return 0
        fi
    fi
    print_skip "GitHub CLI not installed"
    echo "       Install: https://cli.github.com/"
    ((OPTIONAL_SKIP++))
    return 0
}

# Check WP-CLI
check_wpcli() {
    if command -v wp &> /dev/null; then
        local version
        version=$(wp --version 2>&1 | extract_version)
        if [ -n "$version" ]; then
            print_pass "WP-CLI $version"
            ((OPTIONAL_PASS++))
            return 0
        fi
    fi
    print_skip "WP-CLI not installed (Docker includes it internally)"
    echo "       Install: https://wp-cli.org/#installing"
    ((OPTIONAL_SKIP++))
    return 0
}

# Check Node.js
check_node() {
    if command -v node &> /dev/null; then
        local version
        version=$(node --version 2>&1 | extract_version)
        if [ -n "$version" ]; then
            if version_gte "$version" "$MIN_NODE_VERSION"; then
                print_pass "Node.js $version (minimum: $MIN_NODE_VERSION)"
            else
                print_pass "Node.js $version (below recommended $MIN_NODE_VERSION)"
            fi
            ((OPTIONAL_PASS++))
            return 0
        fi
    fi
    print_skip "Node.js not installed"
    echo "       Install: https://nodejs.org/"
    ((OPTIONAL_SKIP++))
    return 0
}

# Check PHP
check_php() {
    if command -v php &> /dev/null; then
        local version
        version=$(php --version 2>&1 | extract_version)
        if [ -n "$version" ]; then
            print_pass "PHP $version"
            ((OPTIONAL_PASS++))
            return 0
        fi
    fi
    print_skip "PHP not installed (Docker provides PHP internally)"
    echo "       Install: https://www.php.net/downloads"
    ((OPTIONAL_SKIP++))
    return 0
}

# Check Composer
check_composer() {
    if command -v composer &> /dev/null; then
        local version
        version=$(composer --version 2>&1 | extract_version)
        if [ -n "$version" ]; then
            print_pass "Composer $version"
            ((OPTIONAL_PASS++))
            return 0
        fi
    fi
    print_skip "Composer not installed"
    echo "       Install: https://getcomposer.org/download/"
    ((OPTIONAL_SKIP++))
    return 0
}

# Check RAM
check_ram() {
    local ram_kb=0
    local ram_gb=0

    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        ram_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        ram_gb=$((ram_kb / 1024 / 1024))
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        ram_bytes=$(sysctl -n hw.memsize)
        ram_gb=$((ram_bytes / 1024 / 1024 / 1024))
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ -n "$WINDIR" ]]; then
        # Windows - try to get from wmic or systeminfo
        ram_kb=$(wmic OS get TotalVisibleMemorySize 2>/dev/null | grep -E '^[0-9]+' | head -1 | tr -d ' \r')
        if [ -n "$ram_kb" ]; then
            ram_gb=$((ram_kb / 1024 / 1024))
        else
            # Fallback for Git Bash
            ram_gb=$MIN_RAM_GB  # Assume minimum if can't detect
        fi
    fi

    if [ "$ram_gb" -ge "$MIN_RAM_GB" ]; then
        print_pass "RAM: ${ram_gb} GB (minimum: ${MIN_RAM_GB} GB)"
        ((SYSTEM_PASS++))
        return 0
    elif [ "$ram_gb" -gt 0 ]; then
        print_fail "RAM: ${ram_gb} GB (minimum: ${MIN_RAM_GB} GB required)"
        ((SYSTEM_FAIL++))
        return 1
    else
        print_info "RAM: Could not detect (minimum: ${MIN_RAM_GB} GB)"
        ((SYSTEM_PASS++))  # Don't fail on detection issues
        return 0
    fi
}

# Check Disk Space
check_disk() {
    local disk_free_gb=0
    local cwd
    cwd=$(pwd)

    if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
        disk_free_kb=$(df -k "$cwd" | tail -1 | awk '{print $4}')
        disk_free_gb=$((disk_free_kb / 1024 / 1024))
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ -n "$WINDIR" ]]; then
        # Windows
        disk_free_gb=$(df -k "$cwd" 2>/dev/null | tail -1 | awk '{print $4}' | head -1)
        if [ -n "$disk_free_gb" ]; then
            disk_free_gb=$((disk_free_gb / 1024 / 1024))
        else
            disk_free_gb=$MIN_DISK_GB  # Assume minimum if can't detect
        fi
    fi

    if [ "$disk_free_gb" -ge "$MIN_DISK_GB" ]; then
        print_pass "Disk: ${disk_free_gb} GB free (minimum: ${MIN_DISK_GB} GB)"
        ((SYSTEM_PASS++))
        return 0
    elif [ "$disk_free_gb" -gt 0 ]; then
        print_fail "Disk: ${disk_free_gb} GB free (minimum: ${MIN_DISK_GB} GB required)"
        ((SYSTEM_FAIL++))
        return 1
    else
        print_info "Disk: Could not detect (minimum: ${MIN_DISK_GB} GB)"
        ((SYSTEM_PASS++))
        return 0
    fi
}

# Check Operating System
check_os() {
    local os_name=""
    local supported=false

    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/os-release ]; then
            os_name=$(grep PRETTY_NAME /etc/os-release | cut -d= -f2 | tr -d '"')
        else
            os_name="Linux"
        fi
        supported=true
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        os_name="macOS $(sw_vers -productVersion)"
        supported=true
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ -n "$WINDIR" ]]; then
        os_name="Windows"
        # Try to get version
        if command -v cmd &> /dev/null; then
            win_ver=$(cmd //c ver 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)
            if [ -n "$win_ver" ]; then
                os_name="Windows $win_ver"
            fi
        fi
        supported=true
    else
        os_name="Unknown ($OSTYPE)"
    fi

    if [ "$supported" = true ]; then
        print_pass "OS: $os_name (supported)"
        ((SYSTEM_PASS++))
        return 0
    else
        print_fail "OS: $os_name (may not be fully supported)"
        ((SYSTEM_FAIL++))
        return 1
    fi
}

# Main execution
main() {
    echo ""
    echo -e "${CYAN}=== Prerequisites Check ===${NC}"

    print_header "REQUIRED SOFTWARE"
    check_git
    check_docker
    check_claude

    print_header "REQUIRED ACCOUNTS"
    print_info "Figma Dev Mode - Manual verification required"
    echo "       Open Figma > Press Shift+D > Dev Mode panel should appear"
    check_gh

    print_header "OPTIONAL SOFTWARE"
    check_wpcli
    check_node
    check_php
    check_composer

    print_header "SYSTEM REQUIREMENTS"
    check_ram
    check_disk
    check_os

    # Summary
    echo ""
    echo -e "${CYAN}=== Summary ===${NC}"
    echo "Required: $REQUIRED_PASS/$((REQUIRED_PASS + REQUIRED_FAIL)) passed"
    echo "Optional: $OPTIONAL_PASS/$((OPTIONAL_PASS + OPTIONAL_SKIP)) installed"
    echo "System:   $SYSTEM_PASS/$((SYSTEM_PASS + SYSTEM_FAIL)) passed"
    echo ""

    if [ "$REQUIRED_FAIL" -eq 0 ] && [ "$SYSTEM_FAIL" -eq 0 ]; then
        echo -e "${GREEN}Ready to use this template: YES${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Start WordPress: ./wordpress-local.sh start"
        echo "  2. Install WordPress: ./wordpress-local.sh install"
        echo "  3. Open Claude Code: claude"
        echo ""
        exit 0
    else
        echo -e "${RED}Ready to use this template: NO${NC}"
        echo ""
        echo "Please install missing requirements above, then run this script again."
        echo ""
        echo "Documentation: docs/PREREQUISITES.md"
        echo ""
        exit 1
    fi
}

# Run main function
main "$@"
