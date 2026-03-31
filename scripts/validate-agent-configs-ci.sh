#!/bin/bash
#
# validate-agent-configs-ci.sh
# CI-friendly wrapper for agent configuration validation.
# Runs full validation and exits non-zero on any error.
#
# Usage in CI:
#   ./scripts/validate-agent-configs-ci.sh
#

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

echo "Running agent configuration validation (CI mode)..."
echo ""

"$SCRIPT_DIR/validate-agent-configs.sh" --dry-run

EXIT_CODE=$?

if [ "$EXIT_CODE" -ne 0 ]; then
  echo ""
  echo "CI FAILURE: Agent configuration validation failed."
  echo "Fix the errors above before merging."
fi

exit "$EXIT_CODE"
