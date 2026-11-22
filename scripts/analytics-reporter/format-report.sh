#!/bin/bash
# Analytics Report Formatter
# Auto-formats analytics reports (JSON/CSV)
# Exit 0 (always - informational)

# Read JSON input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only process analytics report files
if [[ ! "$FILE_PATH" =~ (analytics|report|metrics|stats)\.(json|csv)$ ]]; then
    exit 0
fi

# Check if file exists
if [[ ! -f "$FILE_PATH" ]]; then
    exit 0
fi

FILE_EXT="${FILE_PATH##*.}"

echo "📊 Formatting analytics report: $FILE_PATH" >&2

case "$FILE_EXT" in
    json)
        # Format JSON with jq if available
        if command -v jq &> /dev/null; then
            FORMATTED=$(jq '.' "$FILE_PATH" 2>&1)
            if [ $? -eq 0 ]; then
                echo "$FORMATTED" > "$FILE_PATH"
                echo "  ✓ JSON formatted" >&2
            else
                echo "  ⚠️  JSON formatting failed: invalid JSON" >&2
            fi
        else
            echo "  ℹ️  jq not installed - skipping JSON formatting" >&2
        fi
        ;;

    csv)
        # Basic CSV validation
        if command -v csvlint &> /dev/null; then
            csvlint "$FILE_PATH" 2>&1 >/dev/null
            if [ $? -eq 0 ]; then
                echo "  ✓ CSV validated" >&2
            else
                echo "  ⚠️  CSV validation failed" >&2
            fi
        else
            # Basic check: count columns in first vs other rows
            FIRST_ROW_COLS=$(head -n 1 "$FILE_PATH" | tr ',' '\n' | wc -l)
            INCONSISTENT=false

            while IFS= read -r line; do
                COLS=$(echo "$line" | tr ',' '\n' | wc -l)
                if [ "$COLS" -ne "$FIRST_ROW_COLS" ]; then
                    INCONSISTENT=true
                    break
                fi
            done < "$FILE_PATH"

            if [ "$INCONSISTENT" = true ]; then
                echo "  ⚠️  Inconsistent column count in CSV" >&2
            else
                echo "  ✓ CSV structure validated" >&2
            fi
        fi
        ;;
esac

exit 0
