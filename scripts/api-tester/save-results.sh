#!/bin/bash
# API Test Results Saver
# Saves API test results with timestamps
# Exit 0 (always - informational)

# Read JSON input from stdin
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only process if this was an API testing command
if [[ ! "$COMMAND" =~ (curl|postman|newman|rest-client|api-test|http|fetch) ]]; then
    exit 0
fi

# Create reports directory
REPORTS_DIR=".claude/reports/api-tester"
mkdir -p "$REPORTS_DIR"

# Create timestamped results directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="$REPORTS_DIR/test_$TIMESTAMP"
mkdir -p "$RESULTS_DIR"

# Look for API test result files
RESULT_FILES=()

# Postman/Newman results
[[ -f "newman-report.json" ]] && RESULT_FILES+=(newman-report.json)
[[ -f "newman-report.html" ]] && RESULT_FILES+=(newman-report.html)

# Generic API test results
[[ -f "api-test-results.json" ]] && RESULT_FILES+=(api-test-results.json)
[[ -f "test-results.json" ]] && RESULT_FILES+=(test-results.json)

# REST Client results
[[ -f "rest-client.log" ]] && RESULT_FILES+=(rest-client.log)

# If no result files found, save command output
if [ ${#RESULT_FILES[@]} -eq 0 ]; then
    # Create a result file from the command itself
    cat > "$RESULTS_DIR/command.txt" <<EOF
API Test Command
================
Timestamp: $(date)
Command: $COMMAND

Note: No structured test results found.
This file contains the command that was executed.
EOF

    echo "ℹ️  Saved API test command to: $RESULTS_DIR/command.txt" >&2
    exit 0
fi

# Copy result files
COPIED=0
for file in "${RESULT_FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$RESULTS_DIR/" 2>/dev/null && ((COPIED++))
    fi
done

if [ $COPIED -gt 0 ]; then
    echo "✅ API test results saved to: $RESULTS_DIR" >&2
    echo "   Files saved: ${RESULT_FILES[@]}" >&2

    # Create a summary file
    cat > "$RESULTS_DIR/summary.txt" <<EOF
API Test Results
================
Timestamp: $(date)
Command: $COMMAND
Result Files: ${RESULT_FILES[@]}
EOF

    # Try to extract test statistics from Newman results
    if [ -f "$RESULTS_DIR/newman-report.json" ]; then
        echo "" >> "$RESULTS_DIR/summary.txt"
        echo "Newman Statistics:" >> "$RESULTS_DIR/summary.txt"

        TOTAL=$(jq -r '.run.stats.requests.total // 0' "$RESULTS_DIR/newman-report.json" 2>/dev/null)
        FAILED=$(jq -r '.run.stats.requests.failed // 0' "$RESULTS_DIR/newman-report.json" 2>/dev/null)
        PASSED=$((TOTAL - FAILED))

        echo "  Total Requests: $TOTAL" >> "$RESULTS_DIR/summary.txt"
        echo "  Passed: $PASSED" >> "$RESULTS_DIR/summary.txt"
        echo "  Failed: $FAILED" >> "$RESULTS_DIR/summary.txt"
    fi
else
    echo "⚠️  Failed to copy result files" >&2
fi

exit 0
