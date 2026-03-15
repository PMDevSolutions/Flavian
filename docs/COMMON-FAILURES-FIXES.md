# Common Failures & Fixes Guide

**Comprehensive troubleshooting for Figma-to-WordPress FSE conversion workflow**

**Version:** 1.0.0
**Last Updated:** 2026-03-14

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Setup & Prerequisites Issues](#1-setup--prerequisites-issues)
3. [Figma Extraction Issues](#2-figma-extraction-issues)
4. [Theme Generation Issues](#3-theme-generation-issues)
5. [Visual/Rendering Issues](#4-visualrendering-issues)
6. [Testing & Validation Issues](#5-testing--validation-issues)
7. [Recovery Procedures](#6-recovery-procedures)

---

## Quick Reference

Most common issues and quick fixes:

| Issue | Quick Fix | Section |
|-------|-----------|---------|
| Images broken (empty src) | Use PHP patterns for images | [4.1](#41-images-are-broken-src) |
| Figma MCP won't connect | Open Figma Desktop + enable Dev Mode | [1.2](#12-figma-mcp-connection-failed) |
| Theme won't activate | Check style.css header exists | [3.1](#31-theme-wont-activate-in-wordpress) |
| Hardcoded colors in templates | Re-run with design tokens | [4.2](#42-colors-dont-match-figma) |
| Docker won't start | Check Docker Desktop is running | [1.3](#13-docker-wont-start) |

---

## 1. Setup & Prerequisites Issues

Issues that prevent the workflow from starting.

### 1.1 Claude Code Doesn't Recognize the Project

**Difficulty:** Easy | **Time to Fix:** 2-5 minutes

**Symptom**

Claude Code does not recognize WordPress-specific commands or skills. The Figma-to-FSE skill does not trigger when you mention "convert Figma to WordPress". You see generic responses instead of specialized workflow activation.

**Cause**

The project is missing CLAUDE.md or the .claude/ configuration directory. Claude Code relies on these files to understand project context and available skills.

**Fix**

1. Verify CLAUDE.md exists at project root:
   ```bash
   ls -la "CLAUDE.md"
   ```

2. Verify .claude directory exists with skills:
   ```bash
   ls -la ".claude/skills/"
   ```

3. If missing, re-clone or restore from template:
   ```bash
   git checkout main -- CLAUDE.md .claude/
   ```

4. Restart Claude Code session (close and reopen terminal/IDE).

5. Verify recognition by asking: "What WordPress skills are available?"
   Expected: Claude lists figma-to-fse-autonomous-workflow and other WordPress skills.

**Prevention**

- Never delete CLAUDE.md or .claude/ directory
- Include these in version control (.gitignore should NOT exclude them)
- Verify project structure after major git operations (merge, rebase, checkout)

---

### 1.2 Figma MCP Connection Failed

**Difficulty:** Medium | **Time to Fix:** 5-10 minutes

**Symptom**

Error messages like:
- "Figma MCP unreachable"
- "Connection refused to 127.0.0.1:3845"
- "Failed to connect to Figma Desktop MCP"
- Figma tools (get_variable_defs, get_design_context) return errors

**Cause**

The Figma Desktop app MCP server is not running. This happens when:
- Figma Desktop is not open
- Dev Mode is not enabled in Figma
- The MCP server failed to start
- Firewall blocking port 3845

**Fix**

1. Open Figma Desktop application (not browser version).

2. Open your design file in Figma Desktop.

3. Enable Dev Mode by clicking the `</>` icon in the top toolbar (right side).

4. Verify MCP server is running:
   ```bash
   curl -s http://127.0.0.1:3845/mcp | head -c 100
   ```
   Expected: JSON response (not "connection refused")

5. Check .mcp.json configuration:
   ```bash
   cat ".mcp.json"
   ```
   Expected: Contains "figma-desktop" with url "http://127.0.0.1:3845/mcp"

6. If MCP still not responding, restart Figma Desktop completely.

7. If using remote MCP as fallback, verify authentication:
   ```
   Ask Claude: "Run mcp__figma__whoami to check Figma authentication"
   ```

**Prevention**

- Always open Figma Desktop before starting conversion workflow
- Enable Dev Mode immediately after opening design file
- Keep Figma Desktop in foreground (some systems pause background apps)
- Verify MCP connection with curl before starting long conversions

**Related:** See [docs/MCP-TROUBLESHOOTING.md](./MCP-TROUBLESHOOTING.md) for comprehensive MCP troubleshooting.

---

### 1.3 Docker Won't Start

**Difficulty:** Medium | **Time to Fix:** 5-15 minutes

**Symptom**

Docker commands fail with errors like:
- "Cannot connect to the Docker daemon"
- "docker: command not found"
- "Error response from daemon: driver failed"
- Docker Desktop shows red/yellow status icon

**Cause**

Docker Desktop is not running, not properly installed, or experiencing internal errors. On Windows, WSL2 backend issues can also cause this.

**Fix**

1. Check if Docker Desktop is running (look for icon in system tray):
   - Windows: Look in system tray (bottom right)
   - macOS: Look in menu bar (top right)

2. If not running, start Docker Desktop application.

3. Wait for Docker Desktop to fully initialize (green icon):
   ```bash
   docker info
   ```
   Expected: Shows Docker version and configuration info

4. On Windows, verify WSL2 is enabled:
   ```bash
   wsl --status
   ```
   Expected: Shows "Default Version: 2"

5. If WSL2 issues, update and set default:
   ```bash
   wsl --update
   wsl --set-default-version 2
   ```

6. If Docker Desktop still won't start, reset it:
   - Open Docker Desktop settings
   - Go to "Troubleshoot" section
   - Click "Reset to factory defaults" (warning: removes all containers/images)

7. Verify Docker works after fix:
   ```bash
   docker run hello-world
   ```
   Expected: "Hello from Docker!" message

**Prevention**

- Start Docker Desktop before beginning development session
- Configure Docker Desktop to start on system boot
- Regularly update Docker Desktop
- Allocate sufficient RAM to Docker (minimum 4GB recommended)

**Related:** See [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md#docker--local-development) for Docker-specific issues.

---

### 1.4 Node.js or npm Not Found

**Difficulty:** Easy | **Time to Fix:** 5-10 minutes

**Symptom**

Commands fail with:
- "node: command not found"
- "npm: command not found"
- "npx: command not found"
- Scripts using Node.js fail silently

**Cause**

Node.js is not installed or not in system PATH.

**Fix**

1. Check if Node.js is installed:
   ```bash
   node -v
   ```
   Expected: Version number (v18.0.0 or higher)

2. If not installed, install Node.js:
   - Windows: Download from https://nodejs.org/ or use `winget install OpenJS.NodeJS.LTS`
   - macOS: `brew install node` or download from https://nodejs.org/
   - Linux: `sudo apt install nodejs npm` or use nvm

3. Verify installation:
   ```bash
   node -v && npm -v && npx -v
   ```
   Expected: Version numbers for all three

4. If installed but not found, add to PATH:
   - Windows: Check Environment Variables for Node.js path
   - macOS/Linux: Add to ~/.bashrc or ~/.zshrc:
     ```bash
     export PATH="$PATH:/usr/local/bin/node"
     ```

**Prevention**

- Use Node Version Manager (nvm) for easier Node.js management
- Verify Node.js version compatibility before starting projects (18+ required)
- Document required Node.js version in package.json "engines" field

---

## 2. Figma Extraction Issues

Issues during Phase 1 (Discovery) of the conversion workflow.

### 2.1 Design Tokens Not Extracted Correctly

**Difficulty:** Medium | **Time to Fix:** 10-20 minutes

**Symptom**

After Phase 1.1:
- theme.json has incomplete design tokens
- Missing colors, typography, or spacing
- Fallback defaults used instead of Figma values
- Claude reports "No design system found, using professional fallback tokens"

**Cause**

The design system location was not identified correctly, or Figma variables are not properly defined. Common causes:
- Design system on a page with non-standard name
- Variables defined but not published
- Node ID pointing to wrong frame/page

**Fix**

1. Open Figma and verify design system structure:
   - Variables should be defined in Figma's Variables panel
   - Check Variables panel: Click "Libraries" icon in toolbar

2. Verify page naming matches common conventions:
   ```
   Expected names: "Design System", "Styles", "Tokens", "Library"
   ```

3. Explicitly tell Claude the design system location:
   ```
   "Convert this Figma to FSE. The design system is on the 'Foundations' page."
   ```

4. If variables not defined in Figma, extract from visual styles:
   ```
   "Extract colors and typography from the visual styles in the design,
   not from Figma variables."
   ```

5. Manually verify extracted tokens:
   ```bash
   cat "themes/[theme-name]/theme.json" | jq '.settings.color.palette'
   ```

6. If tokens are wrong, update theme.json manually or re-run extraction with explicit guidance.

**Prevention**

- Use standard naming for design system pages in Figma
- Define variables in Figma Variables panel (not just visual styles)
- Publish variables to the library
- Verify design system location before starting conversion

---

### 2.2 Images Not Downloading

**Difficulty:** Medium | **Time to Fix:** 10-15 minutes

**Symptom**

After conversion:
- `assets/images/` folder is empty or missing images
- Pattern PHP files reference images that don't exist
- 404 errors when loading theme in WordPress

**Cause**

Image assets could not be exported from Figma, or they were not saved to the correct location. This can happen when:
- Figma export API rate limited
- Images stored as fills (not as separate image nodes)
- File permissions prevent saving

**Fix**

1. Check if assets folder exists:
   ```bash
   ls -la "themes/[theme-name]/assets/images/"
   ```

2. If missing, create the directory:
   ```bash
   mkdir -p "themes/[theme-name]/assets/images/"
   ```

3. Export images manually from Figma:
   - Select the image in Figma
   - Right-click > "Export"
   - Export as PNG or WebP
   - Save to `themes/[theme-name]/assets/images/`

4. Verify image paths in pattern files match actual filenames:
   ```bash
   grep -r "get_template_directory_uri" "themes/[theme-name]/patterns/"
   ```

5. Update pattern files if filenames differ:
   ```php
   // Change this:
   <?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/hero-background.png
   // To match actual filename:
   <?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/hero.png
   ```

**Prevention**

- Flatten complex image groups in Figma before conversion
- Use explicit image names in Figma (rename from "Image 1" to "hero-background")
- Verify images exported immediately after conversion completes
- Keep original Figma file accessible for manual export if needed

---

### 2.3 Figma Dev Mode Access Denied

**Difficulty:** Easy | **Time to Fix:** 2-5 minutes

**Symptom**

Error messages like:
- "Dev Mode is not available"
- "Dev Mode requires a paid plan"
- MCP tools return permission errors
- Cannot access design tokens or code export features

**Cause**

Figma Dev Mode requires a paid Figma plan (Professional, Organization, or Enterprise). Free and Starter plans do not include Dev Mode access.

**Fix**

1. Check your Figma plan:
   - Go to Figma.com > Account settings > Plan
   - Dev Mode requires Professional plan or higher

2. If on free plan, consider:
   - Upgrade to Professional plan
   - Request Dev Mode access from team admin (if on team plan)
   - Use screenshot-based extraction (fallback method)

3. For screenshot-based fallback, tell Claude:
   ```
   "Dev Mode is not available. Please extract design from screenshots only."
   ```

4. Alternatively, export design specs manually:
   - Use Figma's "Inspect" panel in edit mode
   - Copy CSS values manually
   - Create theme.json from copied values

**Prevention**

- Verify Figma plan includes Dev Mode before starting project
- Request Dev Mode seat from organization admin in advance
- Document plan requirements in project setup checklist

---

### 2.4 Wrong Node Selected in Figma

**Difficulty:** Easy | **Time to Fix:** 5-10 minutes

**Symptom**

Extracted content does not match expected design:
- Wrong template/frame extracted
- Design system from wrong page
- Partial content extracted (only one component instead of full page)

**Cause**

The Figma node ID passed to MCP tools points to the wrong element. This happens when:
- Multiple frames have similar names
- Selection changed between getting URL and extraction
- URL copied from different frame than intended

**Fix**

1. Verify the correct node is selected in Figma:
   - Open Figma file
   - Select the exact frame/page you want to convert
   - Copy the URL while frame is selected (URL includes node-id parameter)

2. Check the node ID in the Figma URL:
   ```
   https://figma.com/design/[fileKey]/[fileName]?node-id=[nodeId]
   ```
   The node-id should match the selected frame.

3. Re-run extraction with correct URL:
   ```
   "Convert this specific frame to FSE: [correct Figma URL with node-id]"
   ```

4. If extracting design system, explicitly name the page:
   ```
   "Use the 'Design System' page for tokens, not the 'Templates' page."
   ```

**Prevention**

- Always verify selection before copying Figma URL
- Name frames clearly and uniquely in Figma
- Use node-id parameter in URL for precise targeting
- Take screenshot of intended frame before starting conversion

---

### 2.5 Figma File Structure Not Detected

**Difficulty:** Medium | **Time to Fix:** 10-15 minutes

**Symptom**

Claude reports:
- "Could not detect file structure"
- "No templates found"
- "Unable to survey design file"
- Empty implementation plan

**Cause**

The Figma file structure doesn't match expected conventions, or the file is too complex for automatic detection.

**Fix**

1. Simplify Figma file structure:
   ```
   Recommended structure:
   - Page: "Design System" (with variables)
   - Page: "Templates" (with frame per template)
   - Each template as top-level frame
   ```

2. Rename pages and frames to match conventions:
   ```
   Good names: "Homepage", "About Page", "Blog Archive"
   Bad names: "Frame 1", "Untitled", "Copy of Homepage"
   ```

3. Manually specify what to convert:
   ```
   "Convert these specific frames to FSE:
   1. Homepage (frame ID: 123:456)
   2. About (frame ID: 789:012)
   Skip the Design System page."
   ```

4. If file is too complex, break into smaller files or convert one template at a time.

**Prevention**

- Follow Figma naming conventions from start
- Organize files with clear page hierarchy
- Keep template frames at top level (not nested in components)
- Document file structure in Figma file description

---

## 3. Theme Generation Issues

Issues during Phase 2 (Execution) of the conversion workflow.

### 3.1 Theme Won't Activate in WordPress

**Difficulty:** Easy | **Time to Fix:** 5-10 minutes

**Symptom**

In WordPress admin:
- Theme doesn't appear in Appearance > Themes
- Error: "The theme is missing the style.css stylesheet"
- Error: "Theme directory [name] does not exist"
- Theme shows but clicking "Activate" does nothing

**Cause**

The theme is missing required files or has invalid structure. WordPress requires:
- style.css with valid theme header
- For FSE themes: theme.json
- For FSE themes: templates/index.html (or templates/home.html)

**Fix**

1. Verify theme is in correct location for WordPress testing:
   ```bash
   # Development location (this template)
   ls -la "themes/[theme-name]/"

   # Must be copied to WordPress for activation
   ls -la "/path/to/wordpress/wp-content/themes/[theme-name]/"
   ```

2. Copy theme to WordPress installation:
   ```bash
   cp -r "themes/[theme-name]" "/path/to/wordpress/wp-content/themes/"
   ```

3. Verify style.css has valid header:
   ```bash
   head -20 "themes/[theme-name]/style.css"
   ```
   Expected: Theme header with "Theme Name:" field

4. If style.css missing or invalid, create it:
   ```css
   /*
   Theme Name: [Theme Name]
   Theme URI: https://example.com
   Author: [Author Name]
   Description: FSE theme generated from Figma
   Version: 1.0.0
   Requires at least: 6.0
   Tested up to: 6.4
   Requires PHP: 7.4
   License: GPL-2.0-or-later
   Text Domain: [theme-slug]
   */
   ```

5. Verify theme.json exists and is valid JSON:
   ```bash
   cat "themes/[theme-name]/theme.json" | python3 -m json.tool
   ```

6. Verify index template exists:
   ```bash
   ls -la "themes/[theme-name]/templates/index.html"
   ```

**Prevention**

- Always verify theme structure after generation
- Run validation script before deploying: `./scripts/validate-theme.sh [theme-name]`
- Test theme activation before extensive customization

**Related:** See [docs/figma-to-wordpress/README.md](./figma-to-wordpress/README.md#testing-your-theme) for deployment instructions.

---

### 3.2 Missing style.css or theme.json

**Difficulty:** Easy | **Time to Fix:** 5-10 minutes

**Symptom**

After conversion:
- `ls themes/[theme-name]/` shows missing files
- style.css is missing
- theme.json is missing or empty
- WordPress reports missing required files

**Cause**

The conversion workflow was interrupted or encountered an error before creating essential files.

**Fix**

1. Check what files exist:
   ```bash
   ls -la "themes/[theme-name]/"
   ```

2. If theme.json missing, create from template:
   ```bash
   cat > "themes/[theme-name]/theme.json" << 'EOF'
   {
     "$schema": "https://schemas.wp.org/trunk/theme.json",
     "version": 2,
     "settings": {
       "appearanceTools": true,
       "color": {
         "palette": []
       },
       "typography": {
         "fontSizes": []
       },
       "spacing": {
         "spacingSizes": []
       },
       "layout": {
         "contentSize": "768px",
         "wideSize": "1280px"
       }
     }
   }
   EOF
   ```

3. If style.css missing, create with minimal header (see section 3.1 for template).

4. Re-run conversion to populate theme.json with actual values:
   ```
   "The theme.json is empty. Please re-extract design tokens from Figma
   and populate theme.json with colors, typography, and spacing."
   ```

**Prevention**

- Verify workflow completed successfully before testing
- Check completion report in `.claude/reports/figma-fse-comparison.md`
- Don't interrupt Phase 2 execution

---

### 3.3 Patterns Not Registering

**Difficulty:** Medium | **Time to Fix:** 10-15 minutes

**Symptom**

In WordPress:
- Block patterns don't appear in Patterns panel
- Inserting `<!-- wp:pattern {"slug":"themename/pattern"} /-->` shows nothing
- Pattern blocks show "Pattern not found" error

**Cause**

Pattern files are missing required headers or have incorrect slug format. WordPress auto-registers patterns only if headers are correctly formatted.

**Fix**

1. Check pattern file exists:
   ```bash
   ls -la "themes/[theme-name]/patterns/"
   ```

2. Verify pattern header format:
   ```bash
   head -15 "themes/[theme-name]/patterns/hero-section.php"
   ```

   Expected format:
   ```php
   <?php
   /**
    * Title: Hero Section
    * Slug: themename/hero-section
    * Categories: banner
    */
   ?>
   ```

3. Verify slug matches theme name:
   - Theme name (from style.css): "My Theme"
   - Theme slug (directory name): "my-theme"
   - Pattern slug format: "my-theme/pattern-name"

4. Check for PHP syntax errors:
   ```bash
   php -l "themes/[theme-name]/patterns/hero-section.php"
   ```
   Expected: "No syntax errors detected"

5. Fix common header issues:
   - Title is required
   - Slug is required and must be lowercase
   - Categories should be comma-separated if multiple

6. Clear WordPress cache and refresh:
   ```bash
   # If using WP-CLI
   wp cache flush
   ```

**Prevention**

- Use pattern header template consistently
- Verify pattern slugs match theme directory name
- Test patterns individually after creating

**Related:** See [docs/figma-to-wordpress/IMPLEMENTATION.md](./figma-to-wordpress/IMPLEMENTATION.md#pattern-generation) for pattern structure details.

---

### 3.4 Block Markup Validation Errors

**Difficulty:** Medium | **Time to Fix:** 10-20 minutes

**Symptom**

- WordPress shows "This block has encountered an error"
- Block editor crashes when editing template
- Console shows "Block validation failed"
- Template displays incorrectly or not at all

**Cause**

Generated block markup has syntax errors or doesn't match WordPress block grammar. Common issues:
- Unbalanced block tags (missing open or close)
- Invalid JSON in block attributes
- HTML structure doesn't match block expectations
- Self-closing blocks not properly formatted

**Fix**

1. Run template validation:
   ```bash
   ./scripts/figma-fse/validate-template.sh "themes/[theme-name]/templates/front-page.html"
   ```

2. Check for balanced blocks:
   ```bash
   # Count opening tags
   grep -c '<!-- wp:' "themes/[theme-name]/templates/front-page.html"

   # Count closing tags (should be less due to self-closing blocks)
   grep -c '<!-- /wp:' "themes/[theme-name]/templates/front-page.html"
   ```

3. Validate JSON in block attributes:
   ```bash
   # Extract and validate JSON (manual check)
   grep -oP '<!-- wp:\w+ \K\{[^}]+\}' "themes/[theme-name]/templates/front-page.html" | while read json; do
     echo "$json" | python3 -m json.tool > /dev/null || echo "Invalid: $json"
   done
   ```

4. Fix common syntax issues:
   ```html
   <!-- Wrong: Missing closing tag -->
   <!-- wp:paragraph -->
   <p>Text</p>

   <!-- Correct: With closing tag -->
   <!-- wp:paragraph -->
   <p>Text</p>
   <!-- /wp:paragraph -->

   <!-- Wrong: Invalid self-closing -->
   <!-- wp:pattern {"slug":"theme/hero"} -->

   <!-- Correct: Self-closing format -->
   <!-- wp:pattern {"slug":"theme/hero"} /-->
   ```

5. If extensive errors, regenerate template with validation focus:
   ```
   "Please regenerate this template with strict block syntax validation.
   Ensure all blocks are properly balanced."
   ```

**Prevention**

- Enable validation hooks during generation
- Run validation script after every template creation
- Test templates in WordPress block editor immediately

---

### 3.5 Functions.php Errors

**Difficulty:** Medium | **Time to Fix:** 10-15 minutes

**Symptom**

- WordPress shows "There has been a critical error"
- White screen of death after theme activation
- PHP errors in debug log
- Theme activates but some features don't work

**Cause**

functions.php has PHP syntax errors or uses undefined functions/classes.

**Fix**

1. Check for PHP syntax errors:
   ```bash
   php -l "themes/[theme-name]/functions.php"
   ```

2. Check WordPress debug log:
   ```bash
   tail -50 "/path/to/wordpress/wp-content/debug.log"
   ```

3. Common fixes:
   ```php
   // Wrong: Missing semicolon
   $var = 'value'

   // Correct
   $var = 'value';

   // Wrong: Undefined function
   my_undefined_function();

   // Correct: Check if exists
   if ( function_exists( 'my_undefined_function' ) ) {
       my_undefined_function();
   }
   ```

4. If functions.php is complex, simplify to minimal version:
   ```php
   <?php
   /**
    * Theme functions and definitions
    */

   if ( ! defined( 'ABSPATH' ) ) {
       exit;
   }

   // Enqueue styles
   function themename_enqueue_styles() {
       wp_enqueue_style( 'themename-style', get_stylesheet_uri(), array(), '1.0.0' );
   }
   add_action( 'wp_enqueue_scripts', 'themename_enqueue_styles' );
   ```

5. Run coding standards check:
   ```bash
   ./scripts/wordpress/check-coding-standards.sh "themes/[theme-name]/functions.php"
   ```

**Prevention**

- Run `php -l` on all PHP files before deploying
- Enable WP_DEBUG during development
- Use WordPress coding standards from start

---

## 4. Visual/Rendering Issues

Issues with how the theme appears in WordPress.

### 4.1 Images Are Broken (src='')

**Difficulty:** Medium | **Time to Fix:** 15-30 minutes

**Symptom**

- Broken image icons displayed on frontend
- Browser inspector shows `<img src="">`
- Images load in editor but not on frontend
- Pattern images work, template images don't

**Cause**

PHP code was placed in HTML template files, which don't execute PHP. This is the most common FSE issue.

```html
<!-- This DOES NOT work in templates/*.html -->
<img src="<?php echo get_template_directory_uri(); ?>/image.png"/>
<!-- PHP is not executed, resulting in empty src="" -->
```

**Fix**

1. Identify affected templates:
   ```bash
   grep -r 'src=""' "themes/[theme-name]/templates/"
   grep -r '<?php' "themes/[theme-name]/templates/"
   ```

2. Create PHP pattern for image-containing section:
   ```php
   // patterns/hero-section.php
   <?php
   /**
    * Title: Hero Section
    * Slug: themename/hero-section
    * Categories: banner
    */
   ?>
   <!-- wp:cover {"url":"<?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/hero.png","dimRatio":50} -->
   <div class="wp-block-cover">
     <img class="wp-block-cover__image-background" src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/hero.png" alt="Hero background"/>
     <div class="wp-block-cover__inner-container">
       <!-- wp:heading {"level":1} -->
       <h1>Welcome</h1>
       <!-- /wp:heading -->
     </div>
   </div>
   <!-- /wp:cover -->
   ```

3. Update template to reference pattern:
   ```html
   <!-- templates/front-page.html -->
   <!-- wp:template-part {"slug":"header"} /-->

   <!-- wp:pattern {"slug":"themename/hero-section"} /-->

   <!-- wp:template-part {"slug":"footer"} /-->
   ```

4. Verify images exist:
   ```bash
   ls -la "themes/[theme-name]/assets/images/"
   ```

5. Test in WordPress to confirm images load.

**Prevention**

- NEVER put PHP code in .html template files
- ALWAYS use PHP patterns for image-containing sections
- Follow pattern-first architecture from the start
- Run architecture validation: `./scripts/figma-fse/validate-pattern-architecture.sh`

**Related:** See [docs/architecture/PATTERN-FIRST-ARCHITECTURE.md](./architecture/PATTERN-FIRST-ARCHITECTURE.md) for complete guide.

---

### 4.2 Colors Don't Match Figma

**Difficulty:** Medium | **Time to Fix:** 10-20 minutes

**Symptom**

- Theme colors are different from Figma design
- Wrong colors appear on elements
- Default WordPress colors showing instead of design colors
- Some colors correct, others wrong

**Cause**

Design tokens were not extracted correctly, or templates use wrong color slugs. Common causes:
- theme.json has wrong color values
- Template references non-existent color slug
- Hardcoded hex values in templates instead of tokens

**Fix**

1. Compare Figma colors with theme.json:
   ```bash
   cat "themes/[theme-name]/theme.json" | jq '.settings.color.palette'
   ```

2. Check for hardcoded colors in templates:
   ```bash
   grep -r '#[0-9A-Fa-f]\{6\}' "themes/[theme-name]/templates/"
   ```
   Expected: No matches (all colors should use tokens)

3. Update theme.json with correct colors from Figma:
   ```json
   {
     "settings": {
       "color": {
         "palette": [
           {
             "slug": "primary",
             "color": "#0066CC",
             "name": "Primary"
           }
         ]
       }
     }
   }
   ```

4. Replace hardcoded colors in templates with token references:
   ```html
   <!-- Wrong: Hardcoded -->
   <!-- wp:group {"style":{"color":{"background":"#0066CC"}}} -->

   <!-- Correct: Token reference -->
   <!-- wp:group {"backgroundColor":"primary"} -->
   ```

5. Verify color CSS variables are generated:
   - View page source in WordPress
   - Search for `--wp--preset--color--primary`
   - Should show your color value

**Prevention**

- Verify design token extraction before template generation
- Run token compliance check: `./scripts/figma-fse/extract-design-tokens.sh`
- Never use hardcoded colors in templates

---

### 4.3 Typography Looks Wrong

**Difficulty:** Medium | **Time to Fix:** 10-20 minutes

**Symptom**

- Font family doesn't match Figma
- Font sizes are wrong (too big or small)
- Line heights are off
- Font weights not applied correctly

**Cause**

Typography tokens not extracted or applied correctly. Common causes:
- Font family not loaded (web font not enqueued)
- Font sizes using wrong scale
- theme.json typography settings incomplete

**Fix**

1. Check theme.json typography settings:
   ```bash
   cat "themes/[theme-name]/theme.json" | jq '.settings.typography'
   ```

2. Verify font families are defined and loaded:
   ```json
   {
     "settings": {
       "typography": {
         "fontFamilies": [
           {
             "slug": "primary",
             "name": "Primary",
             "fontFamily": "Inter, sans-serif"
           }
         ]
       }
     }
   }
   ```

3. For Google Fonts, add font loading to functions.php:
   ```php
   function themename_enqueue_fonts() {
       wp_enqueue_style(
           'themename-google-fonts',
           'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap',
           array(),
           null
       );
   }
   add_action( 'wp_enqueue_scripts', 'themename_enqueue_fonts' );
   ```

4. Verify font sizes use correct units:
   ```json
   {
     "settings": {
       "typography": {
         "fontSizes": [
           {
             "slug": "base",
             "size": "1rem",
             "name": "Base"
           },
           {
             "slug": "large",
             "size": "1.25rem",
             "name": "Large"
           }
         ]
       }
     }
   }
   ```

5. Check template uses typography tokens:
   ```html
   <!-- wp:paragraph {"fontSize":"base"} -->
   <p>Text content</p>
   <!-- /wp:paragraph -->
   ```

**Prevention**

- Extract all typography variables from Figma
- Load web fonts properly in functions.php
- Use rem units for accessibility
- Test typography on multiple devices

---

### 4.4 Layout Doesn't Match Design

**Difficulty:** Hard | **Time to Fix:** 20-45 minutes

**Symptom**

- Elements positioned incorrectly
- Spacing between elements is wrong
- Grid/columns don't align properly
- Sections overlap or have gaps

**Cause**

Layout structure not properly translated from Figma, or spacing tokens not applied correctly.

**Fix**

1. Verify layout settings in theme.json:
   ```bash
   cat "themes/[theme-name]/theme.json" | jq '.settings.layout'
   ```

2. Check spacing tokens:
   ```bash
   cat "themes/[theme-name]/theme.json" | jq '.settings.spacing.spacingSizes'
   ```

3. Verify correct block structure:
   ```html
   <!-- Proper layout structure -->
   <!-- wp:group {"layout":{"type":"constrained"}} -->
   <div class="wp-block-group">
     <!-- wp:columns {"style":{"spacing":{"blockGap":"var:preset|spacing|40"}}} -->
     <div class="wp-block-columns">
       <!-- wp:column -->
       <div class="wp-block-column">
         <!-- Content -->
       </div>
       <!-- /wp:column -->
     </div>
     <!-- /wp:columns -->
   </div>
   <!-- /wp:group -->
   ```

4. Compare with Figma structure:
   - Open Figma in Dev Mode
   - Check frame layout (auto-layout direction, spacing, padding)
   - Match WordPress block attributes to Figma values

5. Fix common layout issues:
   ```html
   <!-- Add spacing between sections -->
   <!-- wp:group {"style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}}} -->

   <!-- Set container width -->
   <!-- wp:group {"layout":{"type":"constrained","contentSize":"768px"}} -->
   ```

6. For complex layouts, consider creating a pattern and testing in editor first.

**Prevention**

- Map Figma auto-layout to WordPress Group/Columns blocks
- Use spacing tokens consistently
- Test layouts in block editor during development
- Compare side-by-side with Figma during review

---

### 4.5 Responsive Breakpoints Not Working

**Difficulty:** Hard | **Time to Fix:** 30-60 minutes

**Symptom**

- Desktop layout on mobile (no responsiveness)
- Mobile layout on desktop
- Elements don't stack properly on narrow screens
- Text/images overflow on small screens

**Cause**

Responsive styles not properly configured, or layout blocks not using responsive features.

**Fix**

1. Verify theme.json has responsive settings:
   ```json
   {
     "settings": {
       "layout": {
         "contentSize": "768px",
         "wideSize": "1280px"
       }
     }
   }
   ```

2. Use responsive-aware blocks:
   ```html
   <!-- Columns block stacks automatically on mobile -->
   <!-- wp:columns {"isStackedOnMobile":true} -->
   <div class="wp-block-columns is-stacked-on-mobile">
     <!-- columns here -->
   </div>
   <!-- /wp:columns -->
   ```

3. Add responsive spacing:
   ```json
   {
     "styles": {
       "spacing": {
         "padding": {
           "top": "var(--wp--preset--spacing--40)",
           "right": "clamp(1rem, 5vw, 3rem)",
           "bottom": "var(--wp--preset--spacing--40)",
           "left": "clamp(1rem, 5vw, 3rem)"
         }
       }
     }
   }
   ```

4. Add custom responsive CSS if needed:
   ```css
   /* In style.css */
   @media (max-width: 782px) {
     .wp-block-columns {
       flex-direction: column;
     }
   }
   ```

5. Test at multiple breakpoints:
   - Desktop: 1280px+
   - Tablet: 782px-1279px
   - Mobile: <782px

6. Use browser dev tools responsive mode to verify behavior.

**Prevention**

- Design mobile-first in Figma
- Test responsive behavior during development
- Use WordPress responsive block features
- Add viewport meta tag in theme

---

## 5. Testing & Validation Issues

Issues with quality assurance and deployment.

### 5.1 GitHub Actions Failing

**Difficulty:** Medium | **Time to Fix:** 15-30 minutes

**Symptom**

- GitHub Actions workflow shows red X
- Pull request blocked by failing checks
- Error messages in workflow logs
- Tests pass locally but fail in CI

**Cause**

CI environment differs from local, or code has issues not caught locally.

**Fix**

1. Check GitHub Actions log for specific error:
   - Go to repository on GitHub
   - Click "Actions" tab
   - Find failed workflow run
   - Read error messages

2. Common failures and fixes:

   **PHP syntax errors:**
   ```bash
   # Run locally first
   find themes/[theme-name] -name "*.php" -exec php -l {} \;
   ```

   **Missing required files:**
   ```bash
   # Verify structure
   ls -la themes/[theme-name]/style.css
   ls -la themes/[theme-name]/theme.json
   ls -la themes/[theme-name]/templates/index.html
   ```

   **PHPCS failures:**
   ```bash
   ./scripts/wordpress/check-coding-standards.sh themes/[theme-name]
   ```

   **Security scan failures:**
   ```bash
   ./scripts/wordpress/security-scan.sh themes/[theme-name]
   ```

3. Fix issues locally and push:
   ```bash
   git add .
   git commit -m "fix: Address CI failures"
   git push
   ```

4. If environment-specific, check workflow file:
   ```bash
   cat .github/workflows/[workflow-name].yml
   ```
   Verify PHP version, Node version, and dependencies match local.

**Prevention**

- Run validation scripts locally before pushing
- Use pre-commit hooks to catch issues early
- Keep local environment consistent with CI
- Run full test suite before creating PR

**Related:** See [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md#github-actions-failing) for more CI issues.

---

### 5.2 Token Compliance Errors

**Difficulty:** Medium | **Time to Fix:** 15-25 minutes

**Symptom**

- Validation reports "hardcoded values found"
- Token compliance check fails
- Report shows percentage of hardcoded colors/sizes
- Quality checks don't pass

**Cause**

Templates or patterns contain hardcoded values instead of theme.json token references.

**Fix**

1. Run token compliance check:
   ```bash
   ./scripts/figma-fse/extract-design-tokens.sh themes/[theme-name]/theme.json
   ```

2. Find hardcoded values in templates:
   ```bash
   # Hardcoded colors
   grep -rn '#[0-9A-Fa-f]\{3,6\}' themes/[theme-name]/templates/

   # Hardcoded pixel sizes
   grep -rn '"[0-9]\+px"' themes/[theme-name]/templates/
   ```

3. Replace hardcoded colors with token references:
   ```html
   <!-- Before: Hardcoded -->
   <!-- wp:group {"style":{"color":{"background":"#0066CC"}}} -->

   <!-- After: Token reference -->
   <!-- wp:group {"backgroundColor":"primary"} -->
   ```

4. Replace hardcoded spacing with token references:
   ```html
   <!-- Before: Hardcoded -->
   <!-- wp:group {"style":{"spacing":{"padding":{"top":"32px"}}}} -->

   <!-- After: Token reference -->
   <!-- wp:group {"style":{"spacing":{"padding":{"top":"var:preset|spacing|50"}}}} -->
   ```

5. Re-run validation to confirm compliance:
   ```bash
   ./scripts/figma-fse/validate-template.sh themes/[theme-name]/templates/front-page.html
   ```

**Prevention**

- Enable validation hooks during template generation
- Review templates before committing
- Use design tokens from the start
- Target 100% token compliance

---

### 5.3 Security Scan Warnings

**Difficulty:** Medium | **Time to Fix:** 10-30 minutes

**Symptom**

- Security scan reports vulnerabilities
- Warnings about unescaped output
- Nonce validation missing
- Direct database queries flagged

**Cause**

Generated code doesn't follow WordPress security best practices.

**Fix**

1. Run security scan:
   ```bash
   ./scripts/wordpress/security-scan.sh themes/[theme-name]
   ```

2. Fix unescaped output:
   ```php
   // Wrong: Unescaped
   echo $user_input;

   // Correct: Escaped based on context
   echo esc_html( $user_input );           // For HTML content
   echo esc_url( $url );                   // For URLs
   echo esc_attr( $attribute );            // For HTML attributes
   ```

3. Fix direct database queries:
   ```php
   // Wrong: Direct query
   $wpdb->query( "SELECT * FROM table WHERE id = $id" );

   // Correct: Prepared statement
   $wpdb->query( $wpdb->prepare( "SELECT * FROM table WHERE id = %d", $id ) );
   ```

4. Add nonce verification for forms:
   ```php
   // In form
   wp_nonce_field( 'my_action', 'my_nonce' );

   // When processing
   if ( ! wp_verify_nonce( $_POST['my_nonce'], 'my_action' ) ) {
       die( 'Security check failed' );
   }
   ```

5. Check capability before sensitive operations:
   ```php
   if ( ! current_user_can( 'manage_options' ) ) {
       wp_die( 'Unauthorized' );
   }
   ```

6. Re-run security scan to confirm fixes.

**Prevention**

- Follow WordPress security guidelines from start
- Escape all output
- Sanitize all input
- Use prepared statements for database queries
- Run security scan before every commit

**Related:** See [CLAUDE.md](../CLAUDE.md#security-best-practices) for WordPress security guidelines.

---

### 5.4 Performance Issues Detected

**Difficulty:** Medium | **Time to Fix:** 20-40 minutes

**Symptom**

- Performance check reports slow operations
- High database query count
- Large asset sizes
- Lighthouse score below target

**Cause**

Generated theme has performance issues like unoptimized queries, large images, or excessive JavaScript.

**Fix**

1. Run performance check:
   ```bash
   ./scripts/wordpress/check-performance.sh themes/[theme-name]
   ```

2. Optimize images:
   ```bash
   ./scripts/wordpress/optimize-images.sh [theme-name]
   ```

3. Fix database query issues:
   ```php
   // Wrong: Query without limit
   $posts = get_posts( array( 'post_type' => 'post' ) );

   // Correct: With reasonable limit
   $posts = get_posts( array(
       'post_type' => 'post',
       'posts_per_page' => 10
   ) );
   ```

4. Add caching for expensive operations:
   ```php
   $cache_key = 'my_expensive_data';
   $data = wp_cache_get( $cache_key );
   if ( false === $data ) {
       $data = expensive_operation();
       wp_cache_set( $cache_key, $data, '', 3600 );
   }
   ```

5. Defer or async JavaScript loading:
   ```php
   wp_enqueue_script( 'my-script', $url, array(), '1.0', true ); // true = in footer
   ```

6. Re-run performance check to verify improvements.

**Prevention**

- Set post limits on all queries
- Optimize images before including in theme
- Use lazy loading for images
- Enqueue scripts in footer
- Monitor performance during development

---

## 6. Recovery Procedures

How to recover from major issues.

### 6.1 How to Restart a Failed Conversion

**Difficulty:** Easy | **Time to Fix:** 5-15 minutes

**Symptom**

- Conversion stopped midway
- Incomplete theme generated
- Need to start fresh with same Figma file

**Procedure**

1. Check what was created:
   ```bash
   ls -la "themes/[theme-name]/"
   ```

2. Decide: Salvage or start fresh

   **Option A: Salvage existing work**
   - Keep what works (theme.json if complete)
   - Only regenerate failed parts
   - Tell Claude: "Continue from where we stopped. theme.json is complete, regenerate templates."

   **Option B: Start completely fresh**
   ```bash
   # Backup existing (optional)
   mv "themes/[theme-name]" "themes/[theme-name]-backup-$(date +%Y%m%d)"

   # Or delete
   rm -rf "themes/[theme-name]"
   ```

3. Restart conversion with explicit instructions:
   ```
   "Start fresh conversion of [Figma URL].
   Theme name: [theme-name]
   Design system location: [Design System page]
   Convert these templates: Homepage, About, Contact"
   ```

4. Monitor Phase 2 for any issues.

5. Verify completion:
   ```bash
   ls -la "themes/[theme-name]/"
   cat .claude/reports/figma-fse-comparison.md
   ```

**Prevention**

- Don't interrupt Phase 2 execution
- Keep Figma Desktop open throughout
- Ensure stable network connection
- Save Figma file before starting

---

### 6.2 How to Rollback a Broken Theme

**Difficulty:** Easy | **Time to Fix:** 5-10 minutes

**Symptom**

- Theme broke after recent changes
- Need to restore to working version
- WordPress site showing errors

**Procedure**

1. Check git history for last working version:
   ```bash
   git log --oneline "themes/[theme-name]/"
   ```

2. Identify the last working commit hash.

3. Restore specific files or entire theme:

   **Restore entire theme:**
   ```bash
   git checkout [commit-hash] -- "themes/[theme-name]/"
   ```

   **Restore specific file:**
   ```bash
   git checkout [commit-hash] -- "themes/[theme-name]/theme.json"
   ```

4. If not committed, check for backups:
   ```bash
   ls -la "themes/[theme-name]-backup*"
   ```

5. Copy backup if available:
   ```bash
   cp -r "themes/[theme-name]-backup-20260314" "themes/[theme-name]"
   ```

6. Test restored theme in WordPress:
   - Copy to wp-content/themes/
   - Activate theme
   - Verify functionality

7. Commit the rollback if working:
   ```bash
   git add "themes/[theme-name]/"
   git commit -m "rollback: Restore [theme-name] to working version"
   ```

**Prevention**

- Commit after each successful phase
- Create backups before major changes
- Use feature branches for experiments
- Test in staging before production

---

### 6.3 How to Manually Fix Generated Code

**Difficulty:** Medium-Hard | **Time to Fix:** 15-60 minutes

**Symptom**

- Generated code needs manual adjustments
- Automated regeneration not practical
- Specific issues need surgical fixes

**Procedure**

1. Identify the specific issue:
   - Template syntax error → edit templates/*.html
   - Pattern not working → edit patterns/*.php
   - Wrong colors/tokens → edit theme.json
   - PHP errors → edit functions.php

2. **Fixing theme.json:**
   ```bash
   # Edit theme.json
   code "themes/[theme-name]/theme.json"

   # Validate JSON syntax
   cat "themes/[theme-name]/theme.json" | python3 -m json.tool
   ```

3. **Fixing templates:**
   ```bash
   # Edit template
   code "themes/[theme-name]/templates/front-page.html"

   # Validate blocks
   ./scripts/figma-fse/validate-template.sh "themes/[theme-name]/templates/front-page.html"
   ```

4. **Fixing patterns:**
   ```bash
   # Edit pattern
   code "themes/[theme-name]/patterns/hero-section.php"

   # Check PHP syntax
   php -l "themes/[theme-name]/patterns/hero-section.php"
   ```

5. **Common manual fixes:**

   **Fix broken image paths:**
   ```php
   // Change
   <img src=""/>
   // To
   <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/image.png"/>
   ```

   **Fix wrong color slug:**
   ```html
   <!-- Change -->
   {"backgroundColor":"wrong-color"}
   <!-- To -->
   {"backgroundColor":"primary"}
   ```

   **Fix unbalanced blocks:**
   ```html
   <!-- Add missing closing tag -->
   </div>
   <!-- /wp:group -->
   ```

6. Test after each fix:
   - Refresh WordPress
   - Check browser console for errors
   - Verify visual appearance

7. Commit working fixes:
   ```bash
   git add "themes/[theme-name]/"
   git commit -m "fix: Manual corrections to [theme-name]"
   ```

**Prevention**

- Document manual fixes for future reference
- Consider updating automation to avoid same issue
- Create patterns for frequently needed fixes
- Report automation bugs for improvement

---

### 6.4 How to Recover from Corrupted theme.json

**Difficulty:** Medium | **Time to Fix:** 10-20 minutes

**Symptom**

- theme.json shows parse errors
- WordPress reports theme.json invalid
- JSON validation fails
- Editor crashes when opening theme.json

**Procedure**

1. Backup corrupted file:
   ```bash
   cp "themes/[theme-name]/theme.json" "themes/[theme-name]/theme.json.corrupted"
   ```

2. Attempt to identify JSON error:
   ```bash
   cat "themes/[theme-name]/theme.json" | python3 -m json.tool 2>&1
   ```
   Error will show line number and issue.

3. Common JSON fixes:
   ```json
   // Missing comma
   {"a": 1 "b": 2}  // Wrong
   {"a": 1, "b": 2}  // Correct

   // Trailing comma
   {"a": 1, "b": 2,}  // Wrong
   {"a": 1, "b": 2}   // Correct

   // Unquoted key
   {a: 1}  // Wrong
   {"a": 1}  // Correct
   ```

4. If too corrupted, start fresh with minimal theme.json:
   ```bash
   cat > "themes/[theme-name]/theme.json" << 'EOF'
   {
     "$schema": "https://schemas.wp.org/trunk/theme.json",
     "version": 2,
     "settings": {
       "appearanceTools": true,
       "color": {
         "palette": []
       },
       "typography": {
         "fontSizes": []
       },
       "spacing": {
         "spacingSizes": []
       },
       "layout": {
         "contentSize": "768px",
         "wideSize": "1280px"
       }
     }
   }
   EOF
   ```

5. Re-extract design tokens:
   ```
   "theme.json was corrupted and restored to minimal version.
   Please re-extract design tokens from Figma and populate theme.json."
   ```

6. Validate restored theme.json:
   ```bash
   cat "themes/[theme-name]/theme.json" | python3 -m json.tool
   ```

**Prevention**

- Use IDE with JSON validation
- Commit theme.json after successful changes
- Don't manually edit complex JSON without validation
- Keep backups of working theme.json

---

## Related Documentation

- [MCP-TROUBLESHOOTING.md](./MCP-TROUBLESHOOTING.md) - Comprehensive MCP server troubleshooting
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - General troubleshooting for Docker, PHPCS, and hooks
- [Figma-to-WordPress README](./figma-to-wordpress/README.md) - Overview of conversion workflow
- [Implementation Guide](./figma-to-wordpress/IMPLEMENTATION.md) - Technical implementation details
- [Pattern-First Architecture](./architecture/PATTERN-FIRST-ARCHITECTURE.md) - Image handling in FSE themes
- [Testing Guide](./.claude/skills/figma-to-fse-autonomous-workflow/TESTING-GUIDE.md) - Step-by-step testing procedures

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-14 | Initial release with comprehensive issue coverage |

---

**Maintainer:** Claude Code WordPress Template Team
**Last Updated:** 2026-03-14
