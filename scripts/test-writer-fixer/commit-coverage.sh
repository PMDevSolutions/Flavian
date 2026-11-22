#!/bin/bash
# Coverage Data Committer
# Saves final coverage data when test-writer-fixer agent completes
# Exit 0 (always - informational)

# Create reports directory
REPORTS_DIR=".claude/reports/test-writer-fixer"
mkdir -p "$REPORTS_DIR"

# Check if any coverage reports were saved
if [ ! -d "$REPORTS_DIR" ] || [ -z "$(ls -A "$REPORTS_DIR" 2>/dev/null)" ]; then
    echo "ℹ️  No coverage reports to commit" >&2
    exit 0
fi

# Count coverage runs
COVERAGE_RUNS=$(find "$REPORTS_DIR" -maxdepth 1 -type d -name "coverage_*" | wc -l)

if [ "$COVERAGE_RUNS" -eq 0 ]; then
    echo "ℹ️  No coverage runs found" >&2
    exit 0
fi

# Create coverage index
INDEX_FILE="$REPORTS_DIR/index.md"
cat > "$INDEX_FILE" <<EOF
# Test Coverage Reports

Generated: $(date)

## Coverage Runs

EOF

# List all coverage runs
for coverage_dir in "$REPORTS_DIR"/coverage_*; do
    if [ -d "$coverage_dir" ]; then
        DIR_NAME=$(basename "$coverage_dir")
        TIMESTAMP=${DIR_NAME#coverage_}

        # Format timestamp for display
        YEAR=${TIMESTAMP:0:4}
        MONTH=${TIMESTAMP:4:2}
        DAY=${TIMESTAMP:6:2}
        HOUR=${TIMESTAMP:9:2}
        MINUTE=${TIMESTAMP:11:2}
        SECOND=${TIMESTAMP:13:2}

        FORMATTED_DATE="$YEAR-$MONTH-$DAY $HOUR:$MINUTE:$SECOND"

        echo "- [$FORMATTED_DATE](./$DIR_NAME/)" >> "$INDEX_FILE"

        # Add summary if it exists
        if [ -f "$coverage_dir/summary.txt" ]; then
            echo "  \`\`\`" >> "$INDEX_FILE"
            cat "$coverage_dir/summary.txt" | head -n 5 >> "$INDEX_FILE"
            echo "  \`\`\`" >> "$INDEX_FILE"
        fi
        echo "" >> "$INDEX_FILE"
    fi
done

echo "" >> "$INDEX_FILE"
echo "---" >> "$INDEX_FILE"
echo "Total coverage runs: $COVERAGE_RUNS" >> "$INDEX_FILE"

echo "✅ Coverage data committed to: $REPORTS_DIR" >&2
echo "   Total coverage runs: $COVERAGE_RUNS" >&2
echo "   Index: $INDEX_FILE" >&2

exit 0
