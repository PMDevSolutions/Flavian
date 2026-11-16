#!/bin/bash
# WordPress PHPCS Setup Script
# Installs and configures PHP CodeSniffer with WordPress Coding Standards

set -e

echo "🔧 Setting up PHP CodeSniffer with WordPress Coding Standards..." >&2

# Check if Composer is installed
if ! command -v composer &> /dev/null; then
    echo "❌ Composer not found. Please install Composer first:" >&2
    echo "   Visit: https://getcomposer.org/download/" >&2
    exit 2
fi

# Check if PHP is installed
if ! command -v php &> /dev/null; then
    echo "❌ PHP not found. Please install PHP first." >&2
    exit 2
fi

# Create composer.json if it doesn't exist
if [ ! -f "composer.json" ]; then
    echo "📝 Creating composer.json..." >&2
    cat > composer.json <<EOF
{
    "name": "wordpress/template",
    "description": "WordPress development template",
    "require-dev": {
        "squizlabs/php_codesniffer": "^3.7",
        "wp-coding-standards/wpcs": "^3.0",
        "phpcompatibility/phpcompatibility-wp": "^2.1"
    },
    "config": {
        "allow-plugins": {
            "dealerdirect/phpcodesniffer-composer-installer": true
        }
    }
}
EOF
fi

# Install dependencies
echo "📦 Installing PHP CodeSniffer and WordPress Coding Standards..." >&2
composer install --dev --no-interaction 2>&1 | grep -v "^$" >&2 || true

# Check if phpcs is installed
if [ ! -f "vendor/bin/phpcs" ]; then
    echo "❌ PHPCS installation failed" >&2
    exit 2
fi

# Configure WordPress standards
echo "⚙️  Configuring WordPress coding standards..." >&2
./vendor/bin/phpcs --config-set installed_paths vendor/wp-coding-standards/wpcs,vendor/phpcompatibility/phpcompatibility-wp
./vendor/bin/phpcs --config-set default_standard WordPress

# Verify installation
echo "✅ Verifying installation..." >&2
if ./vendor/bin/phpcs -i | grep -q "WordPress"; then
    echo "✅ WordPress Coding Standards installed successfully!" >&2
    echo "   Standards available: $(./vendor/bin/phpcs -i)" >&2
    exit 0
else
    echo "❌ WordPress standards verification failed" >&2
    exit 2
fi
