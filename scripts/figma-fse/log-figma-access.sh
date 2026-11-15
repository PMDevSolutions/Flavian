#!/bin/bash
# Figma MCP Access Logger
# Logs Figma MCP tool usage for debugging and tracking
# Creates audit trail of design system extraction

# Read JSON input from stdin
INPUT=$(cat)

# Extract tool name and parameters
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool // "unknown"' 2>/dev/null)
NODE_ID=$(echo "$INPUT" | jq -r '.tool_input.nodeId // "none"' 2>/dev/null)
FILE_KEY=$(echo "$INPUT" | jq -r '.tool_input.fileKey // "none"' 2>/dev/null)

# Create log directory if it doesn't exist
mkdir -p .claude/logs

# Log file
LOG_FILE=".claude/logs/figma-access.log"

# Timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Log entry
echo "[$TIMESTAMP] Tool: $TOOL_NAME | Node: $NODE_ID | File: $FILE_KEY" >> "$LOG_FILE"

# Echo to stderr for visibility (optional)
if [ "$TOOL_NAME" != "unknown" ]; then
    echo "📝 Logged Figma MCP access: $TOOL_NAME" >&2
fi

# Always exit 0 (don't block)
exit 0
