#!/bin/bash
# Stop Hook: Generate build status report
# Runs when the frontend-developer agent completes
#
# Creates a summary report in .claude/reports/frontend-developer/

REPORT_DIR=".claude/reports/frontend-developer"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/build_${TIMESTAMP}.md"

mkdir -p "$REPORT_DIR"

{
    echo "# Frontend Developer Build Report"
    echo ""
    echo "**Generated:** $(date)"
    echo ""

    # Count modified files by type
    echo "## Files Modified"
    echo ""

    PHP_COUNT=$(git diff --name-only HEAD 2>/dev/null | grep -c '\.php$' || echo 0)
    CSS_COUNT=$(git diff --name-only HEAD 2>/dev/null | grep -c '\.css$' || echo 0)
    JS_COUNT=$(git diff --name-only HEAD 2>/dev/null | grep -c '\.js$' || echo 0)
    HTML_COUNT=$(git diff --name-only HEAD 2>/dev/null | grep -c '\.html$' || echo 0)

    echo "| Type | Count |"
    echo "|------|-------|"
    echo "| PHP | $PHP_COUNT |"
    echo "| CSS | $CSS_COUNT |"
    echo "| JS | $JS_COUNT |"
    echo "| HTML | $HTML_COUNT |"
    echo ""

    # List theme files changed
    echo "## Theme Files Changed"
    echo ""
    git diff --name-only HEAD 2>/dev/null | grep -E '^themes/' || echo "None"
    echo ""

    # Run quick validation
    echo "## Validation Status"
    echo ""

    # Check for security issues in changed PHP files
    CHANGED_PHP=$(git diff --name-only HEAD 2>/dev/null | grep '\.php$')
    if [ -n "$CHANGED_PHP" ] && [ -f "./scripts/wordpress/security-scan.sh" ]; then
        SECURITY_ISSUES=0
        for f in $CHANGED_PHP; do
            if [ -f "$f" ]; then
                echo "{\"tool_input\":{\"file_path\":\"$f\"}}" | ./scripts/wordpress/security-scan.sh > /dev/null 2>&1
                if [ $? -eq 2 ]; then
                    SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
                fi
            fi
        done
        if [ $SECURITY_ISSUES -gt 0 ]; then
            echo "- Security: $SECURITY_ISSUES file(s) with issues"
        else
            echo "- Security: Passed"
        fi
    else
        echo "- Security: No PHP files changed"
    fi

} > "$REPORT_FILE"

echo "Build report saved to: $REPORT_FILE" >&2
exit 0
