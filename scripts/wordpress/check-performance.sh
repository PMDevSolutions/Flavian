#!/bin/bash
# WordPress Performance Validator
# Warns about performance anti-patterns in WordPress code
# Exit 0 (warn) - displays suggestions but doesn't block

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
WARNINGS=()

# Check for get_posts() without caching
if echo "$CONTENT" | grep -E 'get_posts\s*\(' > /dev/null; then
    if ! echo "$CONTENT" | grep -E '(wp_cache_get|get_transient|set_transient)' > /dev/null; then
        WARNINGS+=("Consider caching get_posts() results using transients or object cache")
    fi
fi

# Check for WP_Query without post limits
if echo "$CONTENT" | grep -E 'new\s+WP_Query\s*\(' > /dev/null; then
    # Extract WP_Query arguments
    if ! echo "$CONTENT" | grep -E "'posts_per_page'\s*=>" > /dev/null; then
        WARNINGS+=("WP_Query without posts_per_page limit. This may load too many posts.")
    fi
fi

# Check for database queries in loops (N+1 problem)
if echo "$CONTENT" | grep -E '(foreach|while|for)\s*\(' > /dev/null; then
    if echo "$CONTENT" | grep -E '(get_posts|WP_Query|get_post_meta|\$wpdb->)' > /dev/null; then
        WARNINGS+=("Potential N+1 query problem: Database queries inside loops. Consider using batch queries.")
    fi
fi

# Check for missing transient caching
if echo "$CONTENT" | grep -E '(wp_remote_get|wp_remote_post|file_get_contents\s*\(\s*["\047]http)' > /dev/null; then
    if ! echo "$CONTENT" | grep -E '(get_transient|set_transient)' > /dev/null; then
        WARNINGS+=("Remote HTTP request without transient caching. Consider caching the response.")
    fi
fi

# Check for get_post_meta in loops
if echo "$CONTENT" | grep -E 'get_post_meta\s*\(' > /dev/null; then
    if echo "$CONTENT" | grep -E '(foreach|while|for)\s*\(' > /dev/null; then
        WARNINGS+=("get_post_meta() inside loop. Use update_meta_cache() or WP_Query with 'update_post_meta_cache'")
    fi
fi

# Check for inefficient taxonomy queries
if echo "$CONTENT" | grep -E 'get_terms\s*\(' > /dev/null; then
    if ! echo "$CONTENT" | grep -E "'hide_empty'\s*=>\s*(true|1)" > /dev/null; then
        WARNINGS+=("get_terms() without hide_empty. This may load unnecessary empty terms.")
    fi
fi

# Check for wp_reset_postdata() missing after WP_Query
if echo "$CONTENT" | grep -E 'new\s+WP_Query' > /dev/null; then
    if ! echo "$CONTENT" | grep -E 'wp_reset_postdata\s*\(' > /dev/null; then
        WARNINGS+=("Missing wp_reset_postdata() after custom WP_Query. This can cause unexpected issues.")
    fi
fi

# Check for options autoload
if echo "$CONTENT" | grep -E "add_option\s*\(" > /dev/null; then
    if ! echo "$CONTENT" | grep -E "'autoload'\s*=>\s*'no'" > /dev/null; then
        WARNINGS+=("Consider setting 'autoload' => 'no' for large or rarely-used options")
    fi
fi

# Display warnings if any found
if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "" >&2
    echo "⚡ WordPress Performance Suggestions for: $FILE_PATH" >&2
    echo "" >&2
    for warning in "${WARNINGS[@]}"; do
        echo "  ⚠️  $warning" >&2
    done
    echo "" >&2
    echo "These are suggestions to improve performance." >&2
    echo "For more info: https://developer.wordpress.org/advanced-administration/performance/" >&2
fi

# Always exit 0 (warn, don't block)
exit 0
