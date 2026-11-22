#!/bin/bash
# Deploy themes and plugins from root-level directories to wp-content/
#
# Usage:
#   ./scripts/deploy.sh                    # Deploy all themes and plugins
#   ./scripts/deploy.sh theme <name>       # Deploy specific theme
#   ./scripts/deploy.sh plugin <name>      # Deploy specific plugin
#   ./scripts/deploy.sh --validate         # Validate before deploying
#   ./scripts/deploy.sh --target <path>    # Deploy to custom wp-content path
#
# By default, deploys to the Docker container's wp-content via docker compose cp

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VALIDATE=false
TARGET=""
TYPE=""
NAME=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --validate)
            VALIDATE=true
            shift
            ;;
        --target)
            TARGET="$2"
            shift 2
            ;;
        theme)
            TYPE="theme"
            NAME="$2"
            shift 2
            ;;
        plugin)
            TYPE="plugin"
            NAME="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [theme <name>|plugin <name>] [--validate] [--target <path>]"
            exit 1
            ;;
    esac
done

# Validation function
validate_theme() {
    local theme_path="$1"
    local theme_name=$(basename "$theme_path")
    local errors=0

    echo "Validating theme: $theme_name"

    # Check required files
    if [ ! -f "$theme_path/style.css" ]; then
        echo "  Missing: style.css"
        errors=$((errors + 1))
    fi

    if [ ! -f "$theme_path/theme.json" ]; then
        echo "  Missing: theme.json (required for FSE themes)"
        errors=$((errors + 1))
    fi

    # Run security scan if available
    if [ -f "$PROJECT_ROOT/scripts/wordpress/security-scan.sh" ]; then
        for php_file in "$theme_path"/*.php "$theme_path"/**/*.php; do
            if [ -f "$php_file" ]; then
                echo "{\"tool_input\":{\"file_path\":\"$php_file\"}}" | "$PROJECT_ROOT/scripts/wordpress/security-scan.sh" > /dev/null 2>&1
                if [ $? -eq 2 ]; then
                    echo "  Security issue in: $php_file"
                    errors=$((errors + 1))
                fi
            fi
        done
    fi

    if [ $errors -gt 0 ]; then
        echo "  $errors validation error(s) found"
        return 1
    else
        echo "  Validation passed"
        return 0
    fi
}

deploy_theme() {
    local theme_name="$1"
    local source="$PROJECT_ROOT/themes/$theme_name"

    if [ ! -d "$source" ]; then
        echo "Theme not found: $source"
        exit 1
    fi

    if [ "$VALIDATE" = true ]; then
        validate_theme "$source" || exit 1
    fi

    if [ -n "$TARGET" ]; then
        # Deploy to local filesystem path
        local dest="$TARGET/themes/$theme_name"
        echo "Deploying theme '$theme_name' to: $dest"
        mkdir -p "$dest"
        rsync -av --delete \
            --exclude='node_modules' \
            --exclude='.git' \
            --exclude='*.test.php' \
            --exclude='tests/' \
            "$source/" "$dest/"
    else
        # Deploy via Docker
        echo "Deploying theme '$theme_name' via Docker..."
        docker compose cp "$source/." "wordpress:/var/www/html/wp-content/themes/$theme_name/"
        echo "Activating theme..."
        docker compose exec wordpress wp theme activate "$theme_name" --allow-root 2>/dev/null || true
    fi

    echo "Theme '$theme_name' deployed successfully"
}

deploy_plugin() {
    local plugin_name="$1"
    local source="$PROJECT_ROOT/plugins/$plugin_name"

    if [ ! -d "$source" ] && [ ! -f "$PROJECT_ROOT/plugins/$plugin_name.php" ]; then
        echo "Plugin not found: $source"
        exit 1
    fi

    if [ -n "$TARGET" ]; then
        local dest="$TARGET/plugins/$plugin_name"
        echo "Deploying plugin '$plugin_name' to: $dest"
        mkdir -p "$dest"
        if [ -d "$source" ]; then
            rsync -av --delete \
                --exclude='node_modules' \
                --exclude='.git' \
                --exclude='tests/' \
                "$source/" "$dest/"
        else
            cp "$PROJECT_ROOT/plugins/$plugin_name.php" "$TARGET/plugins/"
        fi
    else
        echo "Deploying plugin '$plugin_name' via Docker..."
        if [ -d "$source" ]; then
            docker compose cp "$source/." "wordpress:/var/www/html/wp-content/plugins/$plugin_name/"
        else
            docker compose cp "$PROJECT_ROOT/plugins/$plugin_name.php" "wordpress:/var/www/html/wp-content/plugins/"
        fi
    fi

    echo "Plugin '$plugin_name' deployed successfully"
}

# Execute based on type
if [ -n "$TYPE" ]; then
    case $TYPE in
        theme) deploy_theme "$NAME" ;;
        plugin) deploy_plugin "$NAME" ;;
    esac
else
    # Deploy all themes and plugins
    echo "=== Deploying all themes ==="
    for theme_dir in "$PROJECT_ROOT/themes"/*/; do
        if [ -d "$theme_dir" ]; then
            theme_name=$(basename "$theme_dir")
            deploy_theme "$theme_name"
        fi
    done

    echo ""
    echo "=== Deploying all plugins ==="
    for plugin_dir in "$PROJECT_ROOT/plugins"/*/; do
        if [ -d "$plugin_dir" ]; then
            plugin_name=$(basename "$plugin_dir")
            deploy_plugin "$plugin_name"
        fi
    done

    # Also deploy single-file plugins
    for plugin_file in "$PROJECT_ROOT/plugins"/*.php; do
        if [ -f "$plugin_file" ] && [ "$(basename "$plugin_file")" != "index.php" ]; then
            plugin_name=$(basename "$plugin_file" .php)
            deploy_plugin "$plugin_name"
        fi
    done

    echo ""
    echo "=== Deployment complete ==="
fi
