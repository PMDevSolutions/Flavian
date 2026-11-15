#!/bin/bash
# Performance Tools Checker
# Verifies that performance profiling tools are available
# Exit 0 (warn about missing tools but don't block)

MISSING_TOOLS=()
WARNINGS=()
AVAILABLE_TOOLS=()

echo "🔍 Checking performance profiling tools..." >&2

# Check for Node.js profiling
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1)
    AVAILABLE_TOOLS+=("Node.js $NODE_VERSION")
else
    WARNINGS+=("Node.js not found - JavaScript profiling unavailable")
fi

# Check for npm (for JavaScript benchmarking)
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version 2>&1)
    AVAILABLE_TOOLS+=("npm $NPM_VERSION")
else
    WARNINGS+=("npm not found - Cannot install JS benchmarking tools")
fi

# Check for Lighthouse
if command -v lighthouse &> /dev/null; then
    LIGHTHOUSE_VERSION=$(lighthouse --version 2>&1)
    AVAILABLE_TOOLS+=("Lighthouse $LIGHTHOUSE_VERSION")
else
    WARNINGS+=("Lighthouse not installed - run: npm install -g lighthouse")
fi

# Check for artillery (load testing)
if command -v artillery &> /dev/null; then
    ARTILLERY_VERSION=$(artillery version 2>&1 | head -n 1)
    AVAILABLE_TOOLS+=("Artillery $ARTILLERY_VERSION")
else
    WARNINGS+=("Artillery not installed - run: npm install -g artillery")
fi

# Check for PHP (for WordPress benchmarking)
if command -v php &> /dev/null; then
    PHP_VERSION=$(php --version 2>&1 | head -n 1)
    AVAILABLE_TOOLS+=("$PHP_VERSION")
else
    WARNINGS+=("PHP not found - PHP profiling unavailable")
fi

# Check for Apache Bench (ab)
if command -v ab &> /dev/null; then
    AVAILABLE_TOOLS+=("Apache Bench (ab)")
else
    WARNINGS+=("Apache Bench (ab) not installed - HTTP load testing unavailable")
fi

# Check for wrk (HTTP benchmarking)
if command -v wrk &> /dev/null; then
    AVAILABLE_TOOLS+=("wrk HTTP benchmarking tool")
else
    WARNINGS+=("wrk not installed - Advanced HTTP benchmarking unavailable")
fi

# Check for curl (basic HTTP testing)
if command -v curl &> /dev/null; then
    AVAILABLE_TOOLS+=("curl")
else
    WARNINGS+=("curl not found - HTTP request testing unavailable")
fi

# Display available tools
if [ ${#AVAILABLE_TOOLS[@]} -gt 0 ]; then
    echo "" >&2
    echo "✅ Available performance tools:" >&2
    for tool in "${AVAILABLE_TOOLS[@]}"; do
        echo "  ✓ $tool" >&2
    done
fi

# Display warnings
if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "" >&2
    echo "⚠️  Performance tools warnings:" >&2
    for warning in "${WARNINGS[@]}"; do
        echo "  ⚠️  $warning" >&2
    done
    echo "" >&2
    echo "Some profiling features may be limited." >&2
    echo "Install missing tools for full functionality." >&2
fi

# Always exit 0 (warn but don't block)
exit 0
