#!/bin/bash
# Test Report Validator
# Validates test report format
# Exit 0 (warn) - displays issues but doesn't block

# Read JSON input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check test report files
if [[ ! "$FILE_PATH" =~ (test-result|test-report|junit)\.(json|xml)$ ]]; then
    exit 0
fi

# Check if file exists
if [[ ! -f "$FILE_PATH" ]]; then
    exit 0
fi

echo "🔍 Validating test report: $FILE_PATH" >&2

FILE_EXT="${FILE_PATH##*.}"

case "$FILE_EXT" in
    json)
        # Validate JSON structure
        if ! jq '.' "$FILE_PATH" > /dev/null 2>&1; then
            echo "  ❌ Invalid JSON" >&2
            exit 0
        fi

        # Check for common test report fields
        HAS_TESTS=$(jq -e '.tests or .testResults or .numTotalTests' "$FILE_PATH" > /dev/null 2>&1 && echo "true" || echo "false")

        if [ "$HAS_TESTS" = "true" ]; then
            echo "  ✓ Valid test report structure" >&2
        else
            echo "  ⚠️  File may not be a standard test report format" >&2
        fi
        ;;

    xml)
        # Basic XML validation for JUnit format
        if grep -q "<testsuite" "$FILE_PATH" && grep -q "</testsuite>" "$FILE_PATH"; then
            echo "  ✓ Valid JUnit XML structure" >&2
        else
            echo "  ⚠️  Not a valid JUnit XML format" >&2
        fi
        ;;
esac

exit 0
