#!/bin/bash
# Install git hooks for this project
# Run once: ./scripts/install-git-hooks.sh
#
# Installs a pre-commit hook that runs security and standards checks
# on staged PHP, HTML, and CSS files before committing.

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
    echo "Error: .git/hooks directory not found. Are you in a git repository?"
    exit 1
fi

cat > "$HOOKS_DIR/pre-commit" << 'HOOK'
#!/bin/bash
# Pre-commit hook: Validates staged WordPress files
# Installed by: ./scripts/install-git-hooks.sh

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
STAGED_PHP=$(git diff --cached --name-only --diff-filter=ACM | grep '\.php$' || true)
STAGED_HTML=$(git diff --cached --name-only --diff-filter=ACM | grep '\.html$' || true)
ERRORS=0

# ── Security scan on staged PHP files ──
if [ -n "$STAGED_PHP" ] && [ -f "$PROJECT_ROOT/scripts/wordpress/security-scan.sh" ]; then
    echo "Running security scan..."
    for f in $STAGED_PHP; do
        if [ -f "$PROJECT_ROOT/$f" ]; then
            RESULT=$(echo "{\"tool_input\":{\"file_path\":\"$PROJECT_ROOT/$f\"}}" | "$PROJECT_ROOT/scripts/wordpress/security-scan.sh" 2>&1)
            EXIT_CODE=$?
            if [ $EXIT_CODE -eq 2 ]; then
                echo "$RESULT" >&2
                ERRORS=$((ERRORS + 1))
            fi
        fi
    done
fi

# ── Block wp-content/ paths ──
ALL_STAGED=$(git diff --cached --name-only --diff-filter=ACM)
if echo "$ALL_STAGED" | grep -qE '^wp-content/(themes|plugins|mu-plugins)/'; then
    echo "Error: Committing files in wp-content/ is not allowed." >&2
    echo "  Use root-level themes/ and plugins/ directories instead." >&2
    ERRORS=$((ERRORS + 1))
fi

# ── Pattern architecture check (no inline images in templates) ──
if [ -n "$STAGED_HTML" ]; then
    for f in $STAGED_HTML; do
        if echo "$f" | grep -q 'templates/' && [ -f "$PROJECT_ROOT/$f" ]; then
            if grep -q '<img' "$PROJECT_ROOT/$f" 2>/dev/null; then
                echo "Warning: Inline <img> in $f (should use PHP patterns)" >&2
            fi
        fi
    done
fi

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo "Commit blocked: $ERRORS security issue(s) found. Fix before committing." >&2
    exit 1
fi

exit 0
HOOK

chmod +x "$HOOKS_DIR/pre-commit"
echo "Pre-commit hook installed successfully."
echo "It will run security scans on staged PHP files before each commit."
echo ""
echo "To bypass (emergency only): git commit --no-verify"
