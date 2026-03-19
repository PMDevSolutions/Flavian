#!/usr/bin/env bash
# check-dead-code.sh — Detect unused code in PHP projects using Psalm or PHPStan
# Exit codes: 0=no dead code, 1=dead code found
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# --- Flags ---
JSON_OUTPUT=false

for arg in "$@"; do
  case "$arg" in
    --json)     JSON_OUTPUT=true ;;
    -h|--help)
      echo "Usage: check-dead-code.sh [--json]"
      echo "  --json   Output results as JSON (machine-parseable)"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg"
      exit 1
      ;;
  esac
done

# --- Check if dead code detection is enabled ---
CONFIG_FILE=".claude/pipeline.config.json"
ENABLED=true

if [[ -f "$CONFIG_FILE" ]] && command -v node &>/dev/null; then
  ENABLED=$(node -e "
    const fs = require('fs');
    try {
      const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
      console.log(config.deadCode?.enabled !== false ? 'true' : 'false');
    } catch (e) {
      console.log('true');
    }
  " 2>/dev/null || echo "true")
fi

if [[ "$ENABLED" == "false" ]]; then
  if $JSON_OUTPUT; then
    echo '{"status": "skipped", "reason": "deadCode.enabled is false in pipeline.config.json"}'
  else
    echo "Dead code detection is disabled in $CONFIG_FILE"
  fi
  exit 0
fi

if ! $JSON_OUTPUT; then
  echo "=== Dead Code Detection (PHP) ==="
  echo ""
fi

# --- Find PHP analysis tool ---
TOOL=""
if [[ -f vendor/bin/psalm ]]; then
  TOOL="psalm"
elif [[ -f vendor/bin/phpstan ]]; then
  TOOL="phpstan"
else
  if ! $JSON_OUTPUT; then
    echo "No PHP analysis tool found. Attempting to install Psalm..."
  fi
  composer require --dev vimeo/psalm 2>/dev/null || {
    if $JSON_OUTPUT; then
      echo '{"status": "error", "reason": "Failed to install Psalm. Run: composer require --dev vimeo/psalm"}'
    else
      echo "  Failed to install Psalm. Install manually: composer require --dev vimeo/psalm"
    fi
    exit 1
  }
  TOOL="psalm"
  if ! $JSON_OUTPUT; then
    echo "  Psalm installed"
    echo ""
  fi
fi

# --- Determine scan targets ---
SCAN_DIRS=""
[[ -d themes ]] && SCAN_DIRS="$SCAN_DIRS themes/"
[[ -d plugins ]] && SCAN_DIRS="$SCAN_DIRS plugins/"
[[ -d mu-plugins ]] && SCAN_DIRS="$SCAN_DIRS mu-plugins/"

if [[ -z "$SCAN_DIRS" ]]; then
  if $JSON_OUTPUT; then
    echo '{"status": "pass", "deadCodeFound": false, "reason": "No themes/, plugins/, or mu-plugins/ directories found"}'
  else
    echo "No PHP directories to scan (themes/, plugins/, mu-plugins/)"
  fi
  exit 0
fi

# --- Run analysis ---
RESULT_FILE=$(mktemp)
trap 'rm -f "$RESULT_FILE"' EXIT
ANALYSIS_EXIT=0

if ! $JSON_OUTPUT; then
  echo "Scanning for dead code with $TOOL..."
  echo "Directories: $SCAN_DIRS"
  echo ""
fi

if [[ "$TOOL" == "psalm" ]]; then
  vendor/bin/psalm --find-dead-code --no-cache $SCAN_DIRS > "$RESULT_FILE" 2>&1 || ANALYSIS_EXIT=$?
else
  vendor/bin/phpstan analyse --level=5 --error-format=table $SCAN_DIRS > "$RESULT_FILE" 2>&1 || ANALYSIS_EXIT=$?
fi

RESULT_OUTPUT=$(cat "$RESULT_FILE")

# --- Process output ---
if $JSON_OUTPUT; then
  if [[ $ANALYSIS_EXIT -eq 0 ]] || [[ -z "$RESULT_OUTPUT" ]]; then
    echo '{"status": "pass", "deadCodeFound": false, "tool": "'"$TOOL"'", "issues": []}'
    exit 0
  else
    echo "{\"status\": \"fail\", \"deadCodeFound\": true, \"tool\": \"$TOOL\", \"raw\": $(echo "$RESULT_OUTPUT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '""')}"
    exit 1
  fi
fi

# --- Human-readable output ---
if [[ $ANALYSIS_EXIT -eq 0 ]] || [[ -z "$RESULT_OUTPUT" ]]; then
  echo "=== Summary ==="
  echo "No dead code detected ($TOOL found no issues)"
  exit 0
fi

echo "$RESULT_OUTPUT" | sed 's/^/  /'
echo ""
echo "=== Summary ==="
echo "Dead code detected — review the output above"
echo "  Tool: $TOOL"
exit 1
