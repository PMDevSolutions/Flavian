#!/bin/bash
# Test Command Validator
# Validates test commands before execution to prevent destructive operations
# Exit 0 (allow) or Exit 2 (block)

# Read JSON input from stdin
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# List of dangerous patterns to block
DANGEROUS_PATTERNS=(
    "rm -rf"
    "DROP DATABASE"
    "DROP TABLE"
    "DELETE FROM.*WHERE 1=1"
    "TRUNCATE"
    "--force"
    "git reset --hard"
    "git clean -fd"
)

# Check for dangerous patterns
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if echo "$COMMAND" | grep -iE "$pattern" > /dev/null; then
        echo "🚨 BLOCKED: Dangerous command pattern detected: $pattern" >&2
        echo "Command: $COMMAND" >&2
        echo "" >&2
        echo "This command could be destructive and has been blocked." >&2
        exit 2
    fi
done

# Check if it's a test command
if ! echo "$COMMAND" | grep -iE '(phpunit|jest|vitest|pytest|npm test|npm run test|composer test|vendor/bin/phpunit)' > /dev/null; then
    # Not a test command, allow it
    exit 0
fi

# Validate test command structure
if echo "$COMMAND" | grep -iE 'phpunit' > /dev/null; then
    # Check for valid PHPUnit options
    if echo "$COMMAND" | grep -E -- '--bootstrap[= ]' > /dev/null; then
        # Has bootstrap, verify it's a safe path
        BOOTSTRAP=$(echo "$COMMAND" | grep -oE '--bootstrap[= ][^ ]+' | cut -d'=' -f2 | tr -d ' ')
        if [[ "$BOOTSTRAP" == /* ]] || [[ "$BOOTSTRAP" =~ ^[A-Za-z]: ]]; then
            echo "⚠️  Warning: PHPUnit bootstrap uses absolute path: $BOOTSTRAP" >&2
            echo "Consider using relative paths for better portability" >&2
        fi
    fi
fi

# Allow the command
exit 0
