#!/bin/bash
# WordPress Security Scanner - Blocks critical security issues
# Exit 2 (block) - prevents operation on critical security vulnerabilities

# Read JSON input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check PHP files
if [[ ! "$FILE_PATH" =~ \.php$ ]]; then
    exit 0
fi

# Read file content
if [[ ! -f "$FILE_PATH" ]]; then
    exit 0
fi

CONTENT=$(cat "$FILE_PATH")
ISSUES=()

# Check for SQL injection patterns (unescaped $wpdb queries)
if echo "$CONTENT" | grep -E '\$wpdb->query\s*\(\s*[^$]' > /dev/null; then
    if ! echo "$CONTENT" | grep -E '\$wpdb->prepare' > /dev/null; then
        ISSUES+=("SQL injection risk: Unescaped \$wpdb->query() detected. Use \$wpdb->prepare()")
    fi
fi

# Check for direct database queries without prepare
if echo "$CONTENT" | grep -E '\$wpdb->(get_results|get_var|get_row|get_col)\s*\(\s*["\047].*\$' > /dev/null; then
    ISSUES+=("SQL injection risk: Variable interpolation in query. Use \$wpdb->prepare()")
fi

# Check for XSS vulnerabilities (direct echo of user input)
if echo "$CONTENT" | grep -E 'echo\s+\$_(GET|POST|REQUEST|COOKIE)\[' > /dev/null; then
    ISSUES+=("XSS vulnerability: Direct echo of user input without escaping. Use esc_html(), esc_attr(), or esc_url()")
fi

# Check for missing sanitization before output
if echo "$CONTENT" | grep -E '(print|echo)\s.*\$_(GET|POST|REQUEST|COOKIE)' > /dev/null; then
    if ! echo "$CONTENT" | grep -E 'esc_(html|attr|url|js|textarea)' > /dev/null; then
        ISSUES+=("XSS vulnerability: User input output without escaping functions")
    fi
fi

# Check for missing nonce validation in form handlers
if echo "$CONTENT" | grep -E '\$_(POST|GET|REQUEST)\[' > /dev/null; then
    if ! echo "$CONTENT" | grep -E '(wp_verify_nonce|check_ajax_referer)' > /dev/null; then
        # Only flag if it looks like a form handler (has update/delete/save operations)
        if echo "$CONTENT" | grep -E '(update_option|update_post_meta|wp_insert_post|wp_update_post|delete_option|delete_post_meta|wp_delete_post)' > /dev/null; then
            ISSUES+=("Missing nonce validation: Form handler processes user input without nonce verification")
        fi
    fi
fi

# Check for unsafe file operations
if echo "$CONTENT" | grep -E 'file_(get_contents|put_contents)\s*\(\s*\$_(GET|POST|REQUEST)' > /dev/null; then
    ISSUES+=("Unsafe file operation: file operation with direct user input. Validate and sanitize paths.")
fi

# Check for eval() usage
if echo "$CONTENT" | grep -E '\beval\s*\(' > /dev/null; then
    ISSUES+=("Critical: eval() detected. This is extremely dangerous and should never be used.")
fi

# Check for unserialize with user input
if echo "$CONTENT" | grep -E 'unserialize\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)' > /dev/null; then
    ISSUES+=("Critical: unserialize() with user input. Use safe alternatives or validate strictly.")
fi

# Check for system/exec/shell_exec with user input
if echo "$CONTENT" | grep -E '(system|exec|shell_exec|passthru)\s*\(.*\$_(GET|POST|REQUEST)' > /dev/null; then
    ISSUES+=("Critical: Command injection risk. System command with user input detected.")
fi

# Check for missing capability checks
if echo "$CONTENT" | grep -E '(update_option|delete_option|wp_insert_post|wp_update_post|wp_delete_post)' > /dev/null; then
    if ! echo "$CONTENT" | grep -E 'current_user_can' > /dev/null; then
        ISSUES+=("Missing capability check: Privileged operation without checking user permissions")
    fi
fi

# If critical issues found, block the operation
if [ ${#ISSUES[@]} -gt 0 ]; then
    echo "🚨 CRITICAL SECURITY ISSUES DETECTED in $FILE_PATH:" >&2
    echo "" >&2
    for issue in "${ISSUES[@]}"; do
        echo "  ❌ $issue" >&2
    done
    echo "" >&2
    echo "Fix these security vulnerabilities before proceeding." >&2
    echo "For help, see: https://developer.wordpress.org/apis/security/" >&2
    exit 2  # Block the operation
fi

exit 0
