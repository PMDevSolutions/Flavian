#!/bin/bash
# Test Results Run Directory Creator
# Creates a timestamped directory for this test analysis run
# Exit 0 (always - informational)

# Create reports directory
REPORTS_DIR=".claude/reports/test-results-analyzer"
mkdir -p "$REPORTS_DIR"

# Create timestamped run directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RUN_DIR="$REPORTS_DIR/run_$TIMESTAMP"
mkdir -p "$RUN_DIR"

# Export run directory path for other hooks
echo "$RUN_DIR" > "$REPORTS_DIR/.current_run"

echo "📁 Created test analysis run directory: $RUN_DIR" >&2

exit 0
