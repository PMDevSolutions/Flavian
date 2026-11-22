#!/bin/bash
# Test Coverage Saver
# Automatically saves test coverage reports with timestamps
# Exit 0 (always - this is informational)

# Read JSON input from stdin
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only process if this was a test command with coverage
if [[ ! "$COMMAND" =~ (phpunit|jest|vitest|pytest).*coverage ]]; then
    exit 0
fi

# Create reports directory
REPORTS_DIR=".claude/reports/test-writer-fixer"
mkdir -p "$REPORTS_DIR"

# Look for coverage files in common locations
COVERAGE_FILES=()

# PHP coverage files
[[ -d "coverage" ]] && COVERAGE_FILES+=(coverage)
[[ -f "coverage.xml" ]] && COVERAGE_FILES+=(coverage.xml)
[[ -f "clover.xml" ]] && COVERAGE_FILES+=(clover.xml)
[[ -f "coverage.json" ]] && COVERAGE_FILES+=(coverage.json)

# JavaScript coverage files
[[ -d "coverage" ]] && COVERAGE_FILES+=(coverage)
[[ -f "coverage/lcov.info" ]] && COVERAGE_FILES+=(coverage/lcov.info)

# Python coverage files
[[ -f ".coverage" ]] && COVERAGE_FILES+=(.coverage)
[[ -f "coverage.xml" ]] && COVERAGE_FILES+=(coverage.xml)
[[ -d "htmlcov" ]] && COVERAGE_FILES+=(htmlcov)

# Remove duplicates
COVERAGE_FILES=($(echo "${COVERAGE_FILES[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '))

if [ ${#COVERAGE_FILES[@]} -eq 0 ]; then
    echo "⚠️  No coverage files found. Coverage may not have been generated." >&2
    echo "   Expected locations: coverage/, coverage.xml, clover.xml, .coverage, htmlcov/" >&2
    exit 0
fi

# Save coverage with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
COVERAGE_DIR="$REPORTS_DIR/coverage_$TIMESTAMP"
mkdir -p "$COVERAGE_DIR"

# Copy coverage files
COPIED=0
for file in "${COVERAGE_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        cp "$file" "$COVERAGE_DIR/" 2>/dev/null && ((COPIED++))
    elif [[ -d "$file" ]]; then
        cp -r "$file" "$COVERAGE_DIR/" 2>/dev/null && ((COPIED++))
    fi
done

if [ $COPIED -gt 0 ]; then
    echo "✅ Coverage report saved to: $COVERAGE_DIR" >&2
    echo "   Files saved: ${COVERAGE_FILES[@]}" >&2

    # Create a summary file
    cat > "$COVERAGE_DIR/summary.txt" <<EOF
Test Coverage Report
====================
Timestamp: $(date)
Command: $COMMAND
Files: ${COVERAGE_FILES[@]}
EOF

else
    echo "⚠️  Failed to copy coverage files" >&2
fi

exit 0
