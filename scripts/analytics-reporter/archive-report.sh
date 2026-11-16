#!/bin/bash
# Analytics Report Archiver
# Saves analytics reports with timestamps when agent completes
# Exit 0 (always - informational)

# Create reports directory
REPORTS_DIR=".claude/reports/analytics-reporter"
mkdir -p "$REPORTS_DIR"

# Look for analytics report files
REPORT_FILES=()

# Common analytics report file patterns
[[ -f "analytics-report.json" ]] && REPORT_FILES+=(analytics-report.json)
[[ -f "analytics-report.csv" ]] && REPORT_FILES+=(analytics-report.csv)
[[ -f "metrics-report.json" ]] && REPORT_FILES+=(metrics-report.json)
[[ -f "metrics.csv" ]] && REPORT_FILES+=(metrics.csv)
[[ -f "stats-report.json" ]] && REPORT_FILES+=(stats-report.json)

# Find any files matching analytics patterns
if [ -d "reports" ]; then
    while IFS= read -r file; do
        REPORT_FILES+=("$file")
    done < <(find reports -type f -name "*analytics*" -o -name "*metrics*" -o -name "*stats*" 2>/dev/null)
fi

if [ ${#REPORT_FILES[@]} -eq 0 ]; then
    echo "ℹ️  No analytics reports found to archive" >&2
    exit 0
fi

# Create timestamped archive directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_DIR="$REPORTS_DIR/report_$TIMESTAMP"
mkdir -p "$ARCHIVE_DIR"

# Copy report files
COPIED=0
for file in "${REPORT_FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$ARCHIVE_DIR/" 2>/dev/null && ((COPIED++))
    fi
done

if [ $COPIED -gt 0 ]; then
    echo "✅ Analytics reports archived to: $ARCHIVE_DIR" >&2
    echo "   Files archived: $COPIED" >&2

    # Create index of all reports
    INDEX_FILE="$REPORTS_DIR/index.md"
    if [ ! -f "$INDEX_FILE" ]; then
        cat > "$INDEX_FILE" <<EOF
# Analytics Reports Archive

## Reports

EOF
    fi

    # Add this report to index
    echo "- [$TIMESTAMP](./$ARCHIVE_DIR/)" >> "$INDEX_FILE"

    # Create summary file
    cat > "$ARCHIVE_DIR/summary.txt" <<EOF
Analytics Report Archive
========================
Timestamp: $(date)
Files: ${REPORT_FILES[@]}
Total Files: $COPIED
EOF

else
    echo "⚠️  Failed to archive report files" >&2
fi

exit 0
