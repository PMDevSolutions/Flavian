---
name: wp-cli-workflows
description: Use when scaffolding WordPress themes or plugins, performing database operations, managing WordPress core/plugins/themes, creating users, or automating WordPress tasks with WP-CLI. Keywords: WP-CLI, scaffold, database, export, import, search-replace, multisite, WordPress automation, wp command
---

# WP-CLI Workflows

## Overview

WP-CLI is the command-line interface for WordPress, enabling rapid scaffolding, database operations, and WordPress management without using the admin dashboard. Proper WP-CLI usage requires understanding command structure, using flags correctly, and following safety practices (backups, dry-runs).

**Core Principle:** ALWAYS use `--dry-run` for destructive operations, ALWAYS backup before database changes, ALWAYS verify command syntax before execution.

## When to Use

Use this skill when:
- Scaffolding new themes or plugins
- Performing database backup/restore/migration
- Updating WordPress core, plugins, or themes
- Creating or managing users
- Running search-replace operations
- Managing multisite installations
- Automating WordPress tasks
- Debugging WordPress issues

**Symptoms that trigger this skill:**
- "scaffold theme"
- "create plugin"
- "export database"
- "import database"
- "search-replace"
- "update WordPress"
- "create user"
- "wp command"

When NOT to use:
- GUI-based admin tasks (user preference for visual interface)
- Simple content creation (better done in admin)
- Tasks requiring visual confirmation

## Quick Reference

### Essential WP-CLI Commands

| Task | Command | Flags to Know |
|------|---------|---------------|
| Download WordPress | `wp core download` | `--version`, `--locale` |
| Create wp-config | `wp config create` | `--dbname`, `--dbuser`, `--dbpass` |
| Install WordPress | `wp core install` | `--url`, `--title`, `--admin_user` |
| Update WordPress | `wp core update` | `--version`, `--force` |
| Scaffold theme | `wp scaffold _s` | `--theme_name`, `--author` |
| Scaffold plugin | `wp scaffold plugin` | `--plugin_name`, `--plugin_description` |
| Activate theme | `wp theme activate` | None |
| Install plugin | `wp plugin install` | `--activate`, `--version` |
| Export database | `wp db export` | `--add-drop-table` |
| Import database | `wp db import` | None |
| Search-replace | `wp search-replace` | `--dry-run`, `--all-tables` |
| Create user | `wp user create` | `--role`, `--user_pass` |
| Flush cache | `wp cache flush` | None |
| Rewrite flush | `wp rewrite flush` | None |

### Safety Flags (ALWAYS use these)

| Flag | Purpose | When to Use |
|------|---------|-------------|
| `--dry-run` | Preview changes without executing | search-replace, destructive operations |
| `--yes` | Skip confirmation prompts | Automation scripts |
| `--skip-plugins` | Run without active plugins | Debugging plugin conflicts |
| `--skip-themes` | Run without active theme | Debugging theme conflicts |
| `--allow-root` | Run as root user | Server environments (use cautiously) |

## Implementation Patterns

### Pattern 1: Fresh WordPress Installation

```bash
#!/bin/bash
# Complete WordPress installation from scratch

# 1. Download WordPress core
wp core download --locale=en_US

# 2. Create wp-config.php
wp config create \
  --dbname=mydb \
  --dbuser=myuser \
  --dbpass=mypassword \
  --dbhost=localhost \
  --dbprefix=wp_

# 3. Install WordPress
wp core install \
  --url=https://example.com \
  --title="My WordPress Site" \
  --admin_user=admin \
  --admin_password=secure_password_here \
  --admin_email=admin@example.com

# 4. Update permalink structure
wp rewrite structure '/%postname%/' --hard

# 5. Flush rewrite rules
wp rewrite flush

# 6. Delete default content
wp post delete 1 --force # Hello World post
wp post delete 2 --force # Sample page
wp comment delete 1 --force # Default comment

# 7. Install essential plugins
wp plugin install wordpress-seo --activate
wp plugin install wordfence --activate

echo "WordPress installed successfully!"
```

### Pattern 2: Theme Scaffolding and Development

```bash
#!/bin/bash
# Scaffold a new WordPress theme with _s (Underscores)

# 1. Navigate to themes directory
cd wp-content/themes/

# 2. Scaffold theme
wp scaffold _s mytheme \
  --theme_name="My Theme" \
  --author="Your Name" \
  --author_uri="https://example.com" \
  --sassify \
  --activate

# 3. Verify theme activation
wp theme list

# 4. Optional: Enable debugging
wp config set WP_DEBUG true --raw
wp config set WP_DEBUG_LOG true --raw
wp config set WP_DEBUG_DISPLAY false --raw

echo "Theme scaffolded and activated!"
```

### Pattern 3: Plugin Scaffolding

```bash
#!/bin/bash
# Scaffold a new WordPress plugin

# 1. Navigate to plugins directory
cd wp-content/plugins/

# 2. Scaffold plugin
wp scaffold plugin myplugin \
  --plugin_name="My Plugin" \
  --plugin_description="A custom WordPress plugin" \
  --plugin_author="Your Name" \
  --plugin_author_uri="https://example.com" \
  --plugin_uri="https://example.com/myplugin" \
  --activate

# 3. Scaffold plugin tests (PHPUnit)
cd myplugin
wp scaffold plugin-tests .

# 4. Install test suite
bash bin/install-wp-tests.sh wordpress_test root '' localhost latest

# 5. Verify plugin activation
wp plugin list

echo "Plugin scaffolded with test suite!"
```

### Pattern 4: Database Backup and Restore

```bash
#!/bin/bash
# Safe database backup and restore workflow

# 1. Export current database
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
wp db export "$BACKUP_FILE" --add-drop-table

echo "Database backed up to: $BACKUP_FILE"

# 2. Verify backup file exists
if [ -f "$BACKUP_FILE" ]; then
    echo "Backup verified: $(ls -lh $BACKUP_FILE)"
else
    echo "ERROR: Backup failed!"
    exit 1
fi

# 3. To restore from backup (DESTRUCTIVE - resets entire database)
# wp db reset --yes
# wp db import "$BACKUP_FILE"

# 4. Verify database connection after restore
# wp db check

echo "Backup complete. To restore, uncomment restore commands."
```

### Pattern 5: Search-Replace for Domain Migration

```bash
#!/bin/bash
# Safe search-replace for domain migration

OLD_DOMAIN="http://localhost:8000"
NEW_DOMAIN="https://example.com"

# 1. ALWAYS backup first
BACKUP_FILE="pre-migration-$(date +%Y%m%d-%H%M%S).sql"
wp db export "$BACKUP_FILE"

echo "Backup created: $BACKUP_FILE"

# 2. DRY RUN first - preview changes
echo "Running dry-run to preview changes..."
wp search-replace "$OLD_DOMAIN" "$NEW_DOMAIN" --dry-run --all-tables

# 3. Ask for confirmation
read -p "Proceed with actual search-replace? (yes/no): " CONFIRM

if [ "$CONFIRM" = "yes" ]; then
    # 4. Execute actual search-replace
    wp search-replace "$OLD_DOMAIN" "$NEW_DOMAIN" --all-tables --skip-columns=guid

    # 5. Flush cache and rewrite rules
    wp cache flush
    wp rewrite flush

    echo "Migration complete!"
else
    echo "Migration cancelled. Backup preserved: $BACKUP_FILE"
fi
```

### Pattern 6: User Management

```bash
#!/bin/bash
# Create and manage WordPress users

# 1. Create admin user
wp user create johndoe john@example.com \
  --role=administrator \
  --user_pass=secure_password \
  --first_name=John \
  --last_name=Doe \
  --display_name="John Doe"

# 2. Create editor user
wp user create janeeditor jane@example.com \
  --role=editor \
  --user_pass=secure_password \
  --send-email

# 3. List all users
wp user list --format=table

# 4. Update user role
wp user set-role johndoe editor

# 5. Delete user (reassign posts to another user)
wp user delete spam_user --reassign=1

echo "User management complete!"
```

### Pattern 7: Plugin and Theme Updates

```bash
#!/bin/bash
# Safe update workflow for WordPress core, plugins, and themes

# 1. Backup database before updates
wp db export "pre-update-$(date +%Y%m%d).sql"

# 2. Check for updates
echo "Checking for updates..."
wp core check-update
wp plugin list --update=available
wp theme list --update=available

# 3. Update WordPress core
wp core update
wp core update-db

# 4. Update all plugins
wp plugin update --all

# 5. Update all themes
wp theme update --all

# 6. Verify site health
wp core verify-checksums
wp plugin verify-checksums --all

# 7. Flush cache
wp cache flush

echo "Updates complete! Database backup: pre-update-$(date +%Y%m%d).sql"
```

### Pattern 8: Multisite Management

```bash
#!/bin/bash
# Multisite installation and management

# 1. Convert existing site to multisite
wp core multisite-convert --title="My Network"

# 2. Create new site in network
wp site create \
  --slug=subsite \
  --title="My Subsite" \
  --email=admin@example.com

# 3. List all sites
wp site list

# 4. Activate plugin network-wide
wp plugin activate akismet --network

# 5. Install theme and network-enable
wp theme install twentytwentyfour --activate
wp theme enable twentytwentyfour --network

# 6. Run command on specific site
wp --url=subsite.example.com post list

# 7. Run command on all sites
wp site list --field=url | xargs -I {} wp --url={} cache flush

echo "Multisite management complete!"
```

### Pattern 9: Debugging and Diagnostics

```bash
#!/bin/bash
# WordPress debugging and diagnostics

# 1. Check WordPress version
wp core version --extra

# 2. Verify core checksums (detect tampering)
wp core verify-checksums

# 3. Check for plugin/theme conflicts
echo "Testing without plugins..."
wp plugin deactivate --all
# Test if issue persists
wp plugin activate --all

# 4. Regenerate thumbnails
wp media regenerate --yes

# 5. Check database
wp db check
wp db optimize

# 6. Export system info for debugging
echo "=== WordPress Version ===" > debug-info.txt
wp core version >> debug-info.txt
echo "=== Active Plugins ===" >> debug-info.txt
wp plugin list --status=active >> debug-info.txt
echo "=== Active Theme ===" >> debug-info.txt
wp theme list --status=active >> debug-info.txt
echo "=== PHP Version ===" >> debug-info.txt
php -v >> debug-info.txt

echo "Debug info saved to: debug-info.txt"
```

### Pattern 10: Post and Content Management

```bash
#!/bin/bash
# Bulk content operations with WP-CLI

# 1. Create posts from CSV
wp post generate --count=10 --post_type=post --post_status=publish

# 2. List all published posts
wp post list --post_status=publish --format=table

# 3. Update post status
wp post update 123 --post_status=draft

# 4. Delete all posts in trash
wp post delete $(wp post list --post_status=trash --format=ids) --force

# 5. Export posts to WXR
wp export --dir=./export --post_type=post

# 6. Import posts from WXR
wp import export.xml --authors=create

# 7. Search posts
wp post list --s="search term" --post_status=any

echo "Content management complete!"
```

## Common Mistakes

### 1. Running search-replace Without Backup

**WRONG:**
```bash
wp search-replace 'old.com' 'new.com' --all-tables
```

**WHY THIS FAILS:**
- No backup if something goes wrong
- Cannot undo changes
- Risk of data corruption

**CORRECT:**
```bash
# Backup first
wp db export backup.sql

# Dry-run to preview
wp search-replace 'old.com' 'new.com' --all-tables --dry-run

# Execute with confirmation
wp search-replace 'old.com' 'new.com' --all-tables
```

### 2. Not Using --dry-run Flag

**WRONG:**
```bash
wp search-replace 'http://' 'https://' --all-tables
```

**WHY THIS FAILS:**
- Immediately modifies database
- No preview of what will change
- Cannot verify before execution

**CORRECT:**
```bash
# Preview changes first
wp search-replace 'http://' 'https://' --all-tables --dry-run

# Then execute if preview looks correct
wp search-replace 'http://' 'https://' --all-tables
```

### 3. Missing --skip-columns=guid Flag

**WRONG:**
```bash
wp search-replace 'old.com' 'new.com'
```

**WHY THIS FAILS:**
- Changes post GUIDs (should remain unchanged)
- Breaks RSS feed readers
- Violates WordPress best practices

**CORRECT:**
```bash
wp search-replace 'old.com' 'new.com' --skip-columns=guid
```

### 4. Not Verifying Database After Import

**WRONG:**
```bash
wp db import backup.sql
# Immediately start using site
```

**WHY THIS FAILS:**
- Import might have failed partially
- Database corruption not detected
- Site may be broken

**CORRECT:**
```bash
wp db import backup.sql
wp db check
wp core version # Verify WordPress is functional
```

### 5. Forgetting to Flush Cache/Rewrites

**WRONG:**
```bash
wp rewrite structure '/%postname%/'
# Forget to flush
```

**WHY THIS FAILS:**
- Permalink changes not applied
- 404 errors on pages
- Users see broken links

**CORRECT:**
```bash
wp rewrite structure '/%postname%/' --hard
wp rewrite flush
wp cache flush
```

### 6. Using --allow-root Without Understanding Risks

**WRONG:**
```bash
sudo wp plugin install akismet --allow-root
```

**WHY THIS FAILS:**
- Creates files owned by root
- WordPress cannot modify those files
- Permission issues

**CORRECT:**
```bash
# Run as web server user, not root
sudo -u www-data wp plugin install akismet
```

### 7. Not Checking Command Success

**WRONG:**
```bash
wp db export backup.sql
wp db reset --yes
wp db import backup.sql
```

**WHY THIS FAILS:**
- If export fails, reset still runs
- Database destroyed with no backup
- Catastrophic data loss

**CORRECT:**
```bash
#!/bin/bash
wp db export backup.sql

if [ $? -eq 0 ]; then
    echo "Backup successful, proceeding..."
    wp db reset --yes
    wp db import backup.sql
else
    echo "Backup failed! Aborting."
    exit 1
fi
```

## Red Flags - Rationalization Detection

| Rationalization | Reality | Correct Action |
|----------------|---------|----------------|
| "Backups take too long" | Data recovery takes longer | Always backup before DB changes |
| "I don't need --dry-run" | Preview prevents disasters | Always dry-run destructive operations |
| "I'll just run it and see" | Irreversible database changes | Test with --dry-run first |
| "--allow-root is easier" | Creates permission nightmares | Use web server user (www-data) |
| "GUIDs don't matter" | Breaks RSS readers | Use --skip-columns=guid |
| "Cache clears automatically" | It doesn't, causes bugs | Always flush cache after changes |
| "The import worked" | Verify, don't assume | Check database integrity after import |

## No Exceptions

**NEVER skip these safety practices:**

1. ✅ **Backup before database operations** - Export SQL before import, reset, search-replace
2. ✅ **Use --dry-run for destructive operations** - Preview changes before applying
3. ✅ **Verify backups exist** - Check file size, verify SQL is valid
4. ✅ **Skip GUID column in search-replace** - Use --skip-columns=guid
5. ✅ **Flush cache and rewrites after changes** - Prevent stale data issues
6. ✅ **Check command exit codes** - Verify success before proceeding
7. ✅ **Run as web server user** - Avoid permission issues

**Time pressure is not a valid reason to skip backups.**
**"It's just a test site" is not a valid reason to skip safety practices.**
**"I'll be careful" is not a substitute for --dry-run.**

## WP-CLI Installation and Setup

### Installing WP-CLI

```bash
# Download WP-CLI
curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar

# Make it executable
chmod +x wp-cli.phar

# Move to PATH
sudo mv wp-cli.phar /usr/local/bin/wp

# Verify installation
wp --info
```

### Bash Completion (Optional)

```bash
# Download bash completion
curl https://raw.githubusercontent.com/wp-cli/wp-cli/master/utils/wp-completion.bash -o ~/.wp-completion.bash

# Add to ~/.bashrc
echo "source ~/.wp-completion.bash" >> ~/.bashrc

# Reload
source ~/.bashrc
```

## Integration with This Template

This skill works with:
- **fse-block-theme-development skill** - Scaffolding themes with WP-CLI
- **wordpress-testing-workflows skill** - Scaffolding test suites
- **wordpress-deployment-automation skill** - Deployment scripts using WP-CLI
- **frontend-developer agent** - Theme setup and development

Complements:
- **git** - commit the resulting theme or content changes with a Conventional Commits message
- **github plugin** - Integrating WP-CLI with GitHub workflows

## WP-CLI Cheat Sheet

### Core Commands

```bash
wp core download              # Download WordPress
wp core config               # Create wp-config.php
wp core install              # Install WordPress
wp core update               # Update WordPress core
wp core version              # Show WordPress version
wp core verify-checksums     # Verify core file integrity
```

### Plugin Commands

```bash
wp plugin install <plugin>   # Install plugin
wp plugin activate <plugin>  # Activate plugin
wp plugin deactivate <plugin> # Deactivate plugin
wp plugin list               # List all plugins
wp plugin update <plugin>    # Update plugin
wp plugin delete <plugin>    # Delete plugin
```

### Theme Commands

```bash
wp theme install <theme>     # Install theme
wp theme activate <theme>    # Activate theme
wp theme list                # List all themes
wp theme update <theme>      # Update theme
wp theme delete <theme>      # Delete theme
```

### Database Commands

```bash
wp db export <file>          # Export database
wp db import <file>          # Import database
wp db reset                  # Drop all tables
wp db check                  # Check database
wp db optimize               # Optimize database
wp db query "<sql>"          # Execute SQL query
```

### User Commands

```bash
wp user create <login> <email> # Create user
wp user list                 # List users
wp user delete <user>        # Delete user
wp user set-role <user> <role> # Change user role
```

## Resources

- [WP-CLI Official Documentation](https://wp-cli.org/)
- [WP-CLI Command Reference](https://developer.wordpress.org/cli/commands/)
- [WP-CLI Handbook](https://make.wordpress.org/cli/handbook/)
- [Common WP-CLI Commands](https://developer.wordpress.org/cli/commands/)
- [WP-CLI GitHub Repository](https://github.com/wp-cli/wp-cli)

---

**Skill Version:** 1.0.0
**Last Updated:** 2026-01-18
**Tested Against:** WP-CLI 2.10+, WordPress 6.7+
**Testing Methodology:** RED-GREEN-REFACTOR (TDD for documentation)
