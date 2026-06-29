# Troubleshooting Guide

Common issues and solutions for the Claude Code WordPress Template.

---

## Docker & Local Development

**See also:** [docker-troubleshooting.md](./docker-troubleshooting.md) for a comprehensive Docker troubleshooting guide covering 15 common issues with platform-specific solutions.

### Docker Desktop not starting

**Symptoms:** `docker compose` commands fail with "Cannot connect to the Docker daemon"

**Solutions:**
1. Open Docker Desktop and wait for it to fully start (green icon in system tray)
2. On Windows, ensure WSL2 is enabled: `wsl --status`
3. Restart Docker Desktop if it's stuck
4. Check Docker service: `docker info`

### Port 8080 already in use

**Symptoms:** `Bind for 0.0.0.0:8080 failed: port is already allocated`

**Solutions:**
1. Find what's using the port:
   ```bash
   # Windows
   netstat -ano | findstr :8080
   # Linux/Mac
   lsof -i :8080
   ```
2. Stop the conflicting service, or change the port in `docker-compose.yml`:
   ```yaml
   ports:
     - "8000:80"  # Use 8000 instead of 8080
   ```

### WordPress container keeps restarting

**Symptoms:** `docker compose ps` shows wordpress container restarting

**Solutions:**
1. Check logs: `./wordpress-local.sh logs`
2. Common cause: database not ready yet. Wait 30 seconds and try again
3. Reset everything: `./wordpress-local.sh clean && ./wordpress-local.sh start`

### WP-CLI not found in container

**Symptoms:** `wp: command not found` when running WP-CLI in Docker

**Solutions:**
1. Use the helper script: `./wordpress-local.sh shell` then run `wp` commands
2. Or use docker exec directly:
   ```bash
   docker compose exec wordpress wp --allow-root <command>
   ```
3. If WP-CLI is missing from the image, install it:
   ```bash
   docker compose exec wordpress bash -c "curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod +x wp-cli.phar && mv wp-cli.phar /usr/local/bin/wp"
   ```

### Database connection error

**Symptoms:** "Error establishing a database connection" in browser

**Solutions:**
1. Wait 30-60 seconds after `docker compose up` (MySQL needs time to initialize)
2. Check MySQL container: `docker compose ps db`
3. Verify credentials match in `docker-compose.yml` (WORDPRESS_DB_* and MYSQL_* vars)
4. Reset database: `./wordpress-local.sh clean && ./wordpress-local.sh start && ./wordpress-local.sh install`

---

## PHPCS & Coding Standards

### "PHPCS not installed"

**Symptoms:** Scripts report PHPCS is not available

**Solutions:**
1. Run the setup script:
   ```bash
   ./scripts/wordpress/setup-phpcs.sh
   ```
2. Or install manually:
   ```bash
   composer install
   ```
3. Verify installation:
   ```bash
   ./vendor/bin/phpcs -i
   ```
   Should list: `WordPress, WordPress-Core, WordPress-Docs, WordPress-Extra`

### PHPCS can't find WordPress standards

**Symptoms:** `ERROR: the "WordPress" coding standard is not installed`

**Solutions:**
1. Re-run setup: `./scripts/wordpress/setup-phpcs.sh`
2. Or manually register:
   ```bash
   ./vendor/bin/phpcs --config-set installed_paths vendor/wp-coding-standards/wpcs
   ```

### Composer not found

**Symptoms:** `composer: command not found`

**Solutions:**
1. Install Composer: https://getcomposer.org/download/
2. Windows: `scoop install composer` or `choco install composer`
3. macOS: `brew install composer`
4. Linux: `sudo apt install composer`

---

## Figma MCP Connection

**See also:** [MCP-TROUBLESHOOTING.md](./MCP-TROUBLESHOOTING.md) for comprehensive MCP troubleshooting.

### Figma Desktop MCP not connecting

**Symptoms:** Figma MCP tools fail with connection errors

**Prerequisites:**
- Figma Desktop app must be open
- Dev Mode must be enabled (requires Figma paid plan)
- MCP server must be running on port 3845

**Solutions:**
1. Open Figma Desktop app
2. Enable Dev Mode: Click the `</>` icon in the toolbar
3. Check MCP is listening:
   ```bash
   curl http://127.0.0.1:3845/mcp
   ```
4. Verify `.mcp.json` configuration:
   ```json
   {
     "mcpServers": {
       "figma-desktop": {
         "type": "http",
         "url": "http://127.0.0.1:3845/mcp"
       }
     }
   }
   ```
5. Restart Figma Desktop if MCP is not responding

### Figma Remote MCP authentication

**Symptoms:** Remote Figma MCP returns 401/403 errors

**Solutions:**
1. Run `mcp__figma__whoami` to check authentication status
2. If unauthenticated, the remote MCP requires a Figma access token
3. Generate a personal access token in Figma: Settings > Account > Personal access tokens
4. Provide the token when prompted by Claude Code

---

## Playwright MCP (Cross-Browser Testing)

**See also:** [MCP-TROUBLESHOOTING.md](./MCP-TROUBLESHOOTING.md) for comprehensive MCP troubleshooting.

### Playwright browsers not installed

**Symptoms:** `browser_navigate` fails with "browser not found" or similar

**Solutions:**
1. Run the setup script:
   ```bash
   ./scripts/setup-playwright.sh
   ```
2. Or install browsers individually:
   ```bash
   npx playwright install chromium
   npx playwright install firefox
   npx playwright install webkit
   ```

### Playwright MCP server not starting

**Symptoms:** Playwright tools are unavailable in Claude Code

**Solutions:**
1. Check Node.js version (18+ required): `node -v`
2. Verify `@playwright/mcp` is available: `npx @playwright/mcp@latest --help`
3. Check `.mcp.json` has the playwright server configured
4. On Linux, install system dependencies: `npx playwright install-deps`

### Cross-browser screenshots fail

**Symptoms:** `scripts/cross-browser-test.sh` errors out

**Solutions:**
1. Ensure Playwright is installed: `./scripts/setup-playwright.sh`
2. Check the target URL is accessible: `curl http://localhost:8080`
3. On headless Linux servers, install display dependencies:
   ```bash
   npx playwright install-deps
   ```
4. Try running with a single browser first:
   ```bash
   ./scripts/cross-browser-test.sh chromium http://localhost:8080
   ```

### WebKit (Safari) renders differently than expected

**Symptoms:** WebKit screenshots look different from real Safari

**Note:** Playwright's WebKit engine closely matches Safari but is not identical. Known differences:
- Font rendering/antialiasing may vary slightly
- Some CSS features may have minor rendering differences
- For pixel-perfect Safari testing, use a real macOS device or BrowserStack

---

## Lighthouse Audits

Lighthouse runs through the project's Lighthouse CI tooling. There is **no
chrome-devtools MCP server configured** in [`.mcp.json`](../.mcp.json) — it ships
only `figma-desktop`, `figma`, and `playwright`. For browser automation use the
Playwright MCP (see the section above and
[MCP-TROUBLESHOOTING.md](./MCP-TROUBLESHOOTING.md)).

### Lighthouse audit fails

**Symptoms:** A Lighthouse run errors out or returns incomplete results

**Solutions:**
1. Make sure WordPress is running and seeded first:
   ```bash
   docker compose up -d wordpress db && bash tests/visual/seed.sh
   ```
2. Run the audit + budget gate locally:
   ```bash
   pnpm lighthouse:run
   ```
3. Give the page time to fully load (especially Docker WordPress sites)
4. If Chrome runs out of memory during the audit, close other applications/tabs

> **Optional:** a Chrome DevTools MCP (Chrome launched with
> `--remote-debugging-port=9222`) is **not configured by default**. Only wire one
> into `.mcp.json` if you add such a server yourself.

---

## Theme Development

### Theme not appearing in WordPress

**Symptoms:** Theme doesn't show in Appearance > Themes

**Solutions:**
1. Verify theme is in the correct directory: `ls themes/<theme-name>/`
2. Check `style.css` has the required header:
   ```css
   /*
   Theme Name: My Theme
   */
   ```
3. For FSE themes, verify `theme.json` exists
4. Restart WordPress: `./wordpress-local.sh restart`
5. Check file permissions in Docker container

### Images not loading in FSE theme

**Symptoms:** Broken image icons on the frontend

**Solutions:**
1. Images in `.html` templates cannot use PHP — this is by design
2. Move image-containing sections to PHP patterns:
   ```php
   <!-- patterns/hero.php -->
   <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/hero.webp" alt="Hero"/>
   ```
3. Reference patterns from templates:
   ```html
   <!-- templates/front-page.html -->
   <!-- wp:pattern {"slug":"theme-name/hero"} /-->
   ```
4. See `docs/architecture/PATTERN-FIRST-ARCHITECTURE.md` for full guide

### theme.json changes not taking effect

**Symptoms:** Color/typography/spacing changes in theme.json don't appear

**Solutions:**
1. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear any caching plugins
3. Verify JSON syntax is valid:
   ```bash
   cat themes/<theme-name>/theme.json | python3 -m json.tool
   ```
4. Check WordPress admin: Appearance > Editor > Styles to verify tokens

---

## Scripts & Hooks

### "Permission denied" on scripts

**Symptoms:** `./scripts/xxx.sh: Permission denied`

**Solutions:**
```bash
chmod +x scripts/**/*.sh
chmod +x .claude/hooks/*.sh
```

### Hook blocks valid code

**Symptoms:** A hook prevents a write that should be allowed

**Solutions:**
1. Check hook output for the specific reason
2. Security hooks only block critical issues (SQL injection, XSS, etc.)
3. Coding standards and performance are warnings only (exit 0)
4. If the `validate-theme-location` hook blocks you, check you're writing to `themes/` not `wp-content/themes/`

### validate-theme-location false positive

**Symptoms:** Hook blocks a file that's not in wp-content/

**Solutions:**
1. Check the full file path — it matches `wp-content/(themes|plugins|mu-plugins)/`
2. If working on deployment scripts that intentionally target wp-content, use `scripts/deploy.sh` instead of writing directly

---

## Git & GitHub

### Pre-commit hook failures

**Symptoms:** `git commit` fails with security/standards errors

**Solutions:**
1. Fix the reported issues (security issues are blocking)
2. Run the specific check manually to see details:
   ```bash
   ./scripts/wordpress/security-scan.sh
   ```
3. Coding standard warnings are non-blocking — commit should still proceed

### GitHub Actions failing

**Symptoms:** CI pipeline fails on pull request

**Solutions:**
1. Check the Actions tab for specific failure logs
2. Common causes:
   - PHP syntax errors in theme files
   - Missing required files (style.css, theme.json, templates/index.html)
   - Security scan detecting unescaped output
3. Run the unified validator locally first:
   ```bash
   ./scripts/validate-theme.sh <theme-name>
   ```

---

## Performance

### Docker WordPress is slow

**Solutions:**
1. Use WSL2 backend (Docker Desktop > Settings > General > Use WSL2)
2. Allocate more resources (Docker Desktop > Settings > Resources)
3. Reduce mounted volumes if not needed
4. Restart Docker Desktop periodically

### Theme loads slowly

**Solutions:**
1. Run the performance checker:
   ```bash
   ./scripts/wordpress/check-performance.sh themes/<theme-name>
   ```
2. Optimize images:
   ```bash
   ./scripts/wordpress/optimize-images.sh <theme-name>
   ```
3. Common issues:
   - Uncached `get_posts()` calls
   - `WP_Query` without post limits
   - Database queries in loops
   - Large unoptimized images

---

## Quick Diagnostic Commands

```bash
# Check everything is running
./wordpress-local.sh status

# Verify Docker
docker compose ps

# Check theme files
ls -la themes/<theme-name>/

# Validate a theme fully
./scripts/validate-theme.sh <theme-name>

# Test PHPCS
./vendor/bin/phpcs --standard=WordPress themes/<theme-name>/functions.php

# Check MCP connections
curl -s http://127.0.0.1:3845/mcp | head -c 100   # Figma Desktop
curl -s https://mcp.figma.com/mcp | head -c 100   # Figma Remote
```
