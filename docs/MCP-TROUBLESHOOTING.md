# MCP (Model Context Protocol) Troubleshooting Guide

**Comprehensive troubleshooting for MCP servers in the Claude Code WordPress Template**

**Version:** 1.0.0
**Last Updated:** 2026-03-14

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Understanding MCP in This Project](#1-understanding-mcp-in-this-project)
3. [Verifying MCP Configuration](#2-verifying-mcp-configuration)
4. [Figma Desktop MCP Issues](#3-figma-desktop-mcp-issues)
5. [Figma Remote MCP Issues](#4-figma-remote-mcp-issues)
6. [Playwright MCP Issues](#5-playwright-mcp-issues)
7. [Chrome DevTools MCP Issues](#6-chrome-devtools-mcp-issues)
8. [Core Memory MCP Issues](#7-core-memory-mcp-issues)
9. [General MCP Debugging](#8-general-mcp-debugging)

---

## Quick Reference

Most common MCP issues and quick fixes:

| Issue | Quick Fix | Section |
|-------|-----------|---------|
| Figma MCP connection refused | Open Figma Desktop + enable Dev Mode | [3.1](#31-cannot-connect-to-figma-desktop-mcp) |
| Playwright browser not found | Run `./scripts/setup-playwright.sh` | [5.1](#51-browser-not-installed) |
| .mcp.json syntax error | Validate JSON with `python3 -m json.tool` | [2.1](#21-validating-mcpjson-syntax) |
| Figma authentication failed | Re-authenticate via Figma whoami | [4.1](#41-authentication-failed-401403) |
| MCP server timeout | Increase timeout or check network | [8.4](#84-handling-mcp-timeouts) |

### Quick Diagnostic Command

```bash
# Run full MCP validation
./scripts/check-mcp.sh
```

---

## 1. Understanding MCP in This Project

### What is MCP?

Model Context Protocol (MCP) enables Claude Code to interact with external services through standardized tool interfaces. MCP servers expose capabilities that Claude can invoke to perform specialized tasks like accessing Figma designs, controlling browsers, or running audits.

### Configured MCP Servers

This project uses the following MCP servers (defined in `.mcp.json`):

| Server | Type | Purpose | URL/Command |
|--------|------|---------|-------------|
| **figma-desktop** | HTTP | Access Figma designs via desktop app | `http://127.0.0.1:3845/mcp` |
| **figma** | HTTP | Fallback Figma access (remote) | `https://mcp.figma.com/mcp` |
| **playwright** | Command | Browser automation & testing | `npx @playwright/mcp@latest --headless` |

### What Each Server Provides

**Figma Desktop MCP**
- Extract design tokens (colors, typography, spacing)
- Get design context from frames and pages
- Export images and assets
- Access Figma variables and styles
- Requires: Figma Desktop app with Dev Mode enabled

**Figma Remote MCP**
- Same capabilities as desktop
- Used as fallback when desktop unavailable
- Requires: Figma authentication token
- May have rate limits

**Playwright MCP**
- Navigate web pages in headless browsers
- Capture screenshots
- Execute JavaScript on pages
- Test across Chromium, Firefox, WebKit
- Requires: Node.js 22.12+, Playwright browsers installed

### How Claude Code Uses MCP

1. Claude Code reads `.mcp.json` on startup
2. HTTP servers are available immediately
3. Command servers start when first invoked
4. Claude calls MCP tools like `mcp__figma__get_design_context`
5. MCP server executes the action and returns results

---

## 2. Verifying MCP Configuration

### 2.1 Validating .mcp.json Syntax

**Difficulty:** Easy | **Time to Fix:** 2 minutes

**Symptom**
Claude Code shows MCP errors on startup, or MCP tools are unavailable. Error messages like:
- "Failed to parse .mcp.json"
- "Invalid JSON in configuration"
- MCP tools missing from available tools list

**Cause**
The `.mcp.json` file has JSON syntax errors (missing commas, unquoted keys, trailing commas).

**Fix**

1. Validate JSON syntax:
   ```bash
   cat ".mcp.json" | python3 -m json.tool
   ```
   Expected: Pretty-printed JSON without errors

2. If syntax error, check for common issues:
   ```bash
   # View the file
   cat ".mcp.json"
   ```

3. Common JSON fixes:
   ```json
   // Wrong: Trailing comma
   {"mcpServers": {"figma": {},}}

   // Correct: No trailing comma
   {"mcpServers": {"figma": {}}}

   // Wrong: Unquoted key
   {mcpServers: {}}

   // Correct: Quoted key
   {"mcpServers": {}}
   ```

4. Restore from known-good configuration if needed:
   ```bash
   git checkout main -- ".mcp.json"
   ```

5. Restart Claude Code to reload configuration.

**Prevention**
- Use an editor with JSON validation (VS Code, JetBrains IDEs)
- Run `./scripts/check-mcp.sh` after editing .mcp.json
- Commit working .mcp.json changes immediately

---

### 2.2 Checking Server Accessibility

**Difficulty:** Easy | **Time to Fix:** 5 minutes

**Symptom**
MCP tools fail with connection errors even though .mcp.json is valid.

**Cause**
The MCP servers are not running or not reachable at the configured URLs.

**Fix**

1. Check Figma Desktop MCP:
   ```bash
   curl -s http://127.0.0.1:3845/mcp | head -c 200
   ```
   Expected: JSON response (not "connection refused")

2. Check Figma Remote MCP:
   ```bash
   curl -s https://mcp.figma.com/mcp | head -c 200
   ```
   Expected: JSON response (may require auth)

3. Check Playwright MCP availability:
   ```bash
   npx @playwright/mcp@latest --help 2>&1 | head -5
   ```
   Expected: Help text, not "command not found"

4. Run full validation:
   ```bash
   ./scripts/check-mcp.sh
   ```

**Prevention**
- Start required applications before using MCP tools
- Run `./scripts/check-mcp.sh` at start of development session
- Keep Figma Desktop open during design-related work

---

### 2.3 Expected Behavior When Working

When MCP is properly configured:

**Figma MCP (working)**
```
Claude: "Using mcp__figma-desktop__get_design_context..."
Result: Returns design JSON with frames, styles, and metadata
```

**Playwright MCP (working)**
```
Claude: "Using mcp__playwright__browser_navigate..."
Result: Page navigates successfully, returns page content
```

**Common indicators of working MCP:**
- Claude mentions using MCP tools in responses
- Design extraction returns actual Figma data
- Browser screenshots are captured successfully
- No connection timeout errors

---

## 3. Figma Desktop MCP Issues

### 3.1 Cannot Connect to Figma Desktop MCP

**Difficulty:** Easy | **Time to Fix:** 5 minutes

**Symptom**
Error messages like:
- "Connection refused to 127.0.0.1:3845"
- "Figma MCP unreachable"
- "Failed to connect to Figma Desktop MCP"
- `mcp__figma-desktop__*` tools return errors

**Cause**
The Figma Desktop MCP server is not running. This happens when:
- Figma Desktop application is not open
- Dev Mode is not enabled in Figma
- Figma is open but MCP server failed to start
- Firewall blocking localhost port 3845

**Fix**

1. Open Figma Desktop application (not browser version).

2. Open a design file in Figma Desktop.

3. Enable Dev Mode by clicking the `</>` icon in the top toolbar:
   - Location: Top-right area of Figma interface
   - The icon should appear highlighted/active when enabled

4. Verify MCP server is running:
   ```bash
   curl -s http://127.0.0.1:3845/mcp | head -c 100
   ```
   Expected: JSON response starting with `{`

5. If still not responding, restart Figma Desktop completely:
   - Close Figma Desktop
   - Wait 5 seconds
   - Reopen Figma Desktop
   - Open design file
   - Enable Dev Mode

6. Check firewall settings if on corporate network:
   - Allow localhost connections on port 3845
   - Temporarily disable firewall to test

**Prevention**
- Always open Figma Desktop before starting conversion workflow
- Enable Dev Mode immediately after opening design file
- Keep Figma Desktop in foreground (some systems pause background apps)
- Add `curl http://127.0.0.1:3845/mcp` check to your startup routine

---

### 3.2 Figma File Not Found

**Difficulty:** Easy | **Time to Fix:** 5 minutes

**Symptom**
Error messages like:
- "File not found"
- "Invalid file key"
- "Cannot access Figma file"
- `get_design_context` returns empty or error

**Cause**
The Figma file key or URL is incorrect, or the file was deleted/moved.

**Fix**

1. Verify the Figma URL format:
   ```
   https://www.figma.com/design/[fileKey]/[fileName]?node-id=[nodeId]
   ```
   The `fileKey` is the string after `/design/` and before the next `/`.

2. Open the URL in a browser to verify file exists.

3. Check you have access to the file:
   - File must be shared with your Figma account
   - Or file must be in a team you belong to

4. Copy fresh URL from Figma:
   - Open file in Figma
   - Copy URL from browser address bar
   - Provide new URL to Claude

5. If file was recently created, wait 30 seconds for Figma to sync.

**Prevention**
- Verify Figma URLs open correctly in browser before using
- Use permanent file links (not branch-specific)
- Keep files in shared team projects for consistent access

---

### 3.3 Permission Denied / Access Denied

**Difficulty:** Medium | **Time to Fix:** 10 minutes

**Symptom**
Error messages like:
- "Permission denied"
- "Access denied to file"
- "You don't have access to this resource"
- 403 errors from Figma MCP

**Cause**
Your Figma account doesn't have permission to access the file, or the file requires specific access levels.

**Fix**

1. Check your Figma account access:
   - Open the file URL in a browser while logged into Figma
   - If you can't view it there, you don't have access

2. Request access:
   - Ask the file owner to share it with you
   - Request "Can view" access minimum
   - For full extraction, "Can edit" may be needed

3. Check team membership:
   - Files in team projects require team membership
   - Contact team admin to be added

4. Verify correct Figma account:
   - Multiple Figma accounts? Ensure correct one is logged in
   - Check: Figma > Account menu > verify email

5. For personal files, ensure you're the owner or have explicit share.

**Prevention**
- Work with files in shared team projects
- Document required access levels in project setup
- Verify access before starting conversion workflow

---

### 3.4 Node Not Found

**Difficulty:** Easy | **Time to Fix:** 5 minutes

**Symptom**
Error messages like:
- "Node not found"
- "Invalid node ID"
- "Cannot find node: 123:456"
- Extraction returns empty for specific nodes

**Cause**
The node ID in the URL or request doesn't exist in the file. This happens when:
- Node was deleted after URL was copied
- Node ID was manually entered incorrectly
- URL points to a different file version

**Fix**

1. Get a fresh node ID from Figma:
   - Open the file in Figma
   - Select the frame/element you want
   - Copy the URL (it includes `node-id=X:Y`)

2. Verify the node exists:
   - Check Figma's Layers panel
   - Search for the element by name

3. Use the correct URL format:
   ```
   https://www.figma.com/design/ABC123/FileName?node-id=1:2
   ```
   The `node-id=1:2` part identifies the specific element.

4. If targeting a page, ensure you're using page node ID:
   - Pages have node IDs like `0:1`, `0:2`, etc.
   - Frames have node IDs like `1:234`

**Prevention**
- Always copy URL after selecting the correct element
- Take a screenshot of the selected element for reference
- Use descriptive frame names for easier identification

---

### 3.5 Design Context Extraction Failed

**Difficulty:** Medium | **Time to Fix:** 10-20 minutes

**Symptom**
Error messages like:
- "Design context extraction failed"
- "Could not extract design data"
- Empty or partial design data returned
- Missing colors, typography, or component information

**Cause**
The design structure is too complex, contains unsupported elements, or MCP encountered an internal error.

**Fix**

1. Try extracting a smaller portion:
   ```
   "Extract design tokens from just the 'Design System' page"
   ```

2. Check Figma file structure:
   - Ensure design system elements are organized
   - Variables should be in Figma's Variables panel
   - Styles should be properly defined

3. Simplify the request:
   ```
   "First, just extract the color palette from Figma"
   ```

4. Check for very large files:
   - Files with 100+ pages may timeout
   - Split into smaller files or extract page by page

5. Restart Figma Desktop and try again:
   - Close and reopen Figma
   - Re-enable Dev Mode
   - Attempt extraction again

6. Use the fallback remote MCP:
   ```
   "Use the remote Figma MCP (mcp.figma.com) instead of desktop"
   ```

**Prevention**
- Organize Figma files with clear page structure
- Use Figma Variables for design tokens
- Keep files under 50 pages when possible
- Test extraction on design system page first

---

### 3.6 Dev Mode Not Enabled

**Difficulty:** Easy | **Time to Fix:** 2 minutes

**Symptom**
Error messages like:
- "Dev Mode is required"
- "Enable Dev Mode to use this feature"
- MCP tools fail silently or return incomplete data

**Cause**
Dev Mode is not enabled in Figma Desktop, or your Figma plan doesn't include Dev Mode.

**Fix**

1. Enable Dev Mode in Figma Desktop:
   - Look for `</>` icon in top toolbar (right side)
   - Click to enable (icon becomes highlighted)
   - You should see "Dev Mode" label in the interface

2. If icon is not visible:
   - Check your Figma plan (Dev Mode requires Professional+)
   - Free/Starter plans do not include Dev Mode

3. For paid plans where Dev Mode won't enable:
   - Ensure you're in a file, not the home screen
   - Close and reopen the file
   - Restart Figma Desktop

4. If no paid plan, use screenshot-based fallback:
   ```
   "I don't have Dev Mode access. Please extract design from
   screenshots and manual inspection instead."
   ```

**Prevention**
- Verify Figma plan includes Dev Mode before starting project
- Document Dev Mode requirement in project prerequisites
- Enable Dev Mode as first step when opening design files

---

### 3.7 MCP Server Not Starting

**Difficulty:** Medium | **Time to Fix:** 10-15 minutes

**Symptom**
Figma Desktop is open with Dev Mode enabled, but MCP still doesn't respond:
- `curl http://127.0.0.1:3845/mcp` times out
- No response at all (not even "connection refused")

**Cause**
The MCP server component of Figma Desktop failed to initialize, possibly due to:
- Figma Desktop version too old
- Corrupted installation
- Port conflict with another application
- System-level restrictions

**Fix**

1. Check Figma Desktop version:
   - Figma > Help > About Figma
   - MCP requires a recent version (2024+)

2. Update Figma Desktop:
   - Figma > Help > Check for Updates
   - Or download latest from figma.com/downloads

3. Check for port conflicts:
   ```bash
   # Windows
   netstat -ano | findstr :3845
   # macOS/Linux
   lsof -i :3845
   ```
   If another process is using 3845, stop it.

4. Restart computer (clears any stuck processes).

5. Reinstall Figma Desktop:
   - Uninstall current version
   - Download fresh from figma.com/downloads
   - Install and log in again

6. Try running Figma as administrator (Windows) or with sudo (macOS/Linux).

**Prevention**
- Keep Figma Desktop updated
- Don't run other apps on port 3845
- Check `curl http://127.0.0.1:3845/mcp` after opening Figma

---

## 4. Figma Remote MCP Issues

### 4.1 Authentication Failed (401/403)

**Difficulty:** Medium | **Time to Fix:** 10 minutes

**Symptom**
Error messages like:
- "401 Unauthorized"
- "403 Forbidden"
- "Authentication required"
- "Invalid or expired token"

**Cause**
The Figma remote MCP requires authentication, and your token is missing, invalid, or expired.

**Fix**

1. Check authentication status with Claude:
   ```
   "Run mcp__figma__whoami to check Figma authentication"
   ```

2. If unauthenticated, generate a new personal access token:
   - Go to figma.com
   - Click your profile icon > Settings
   - Go to "Personal access tokens"
   - Click "Generate new token"
   - Copy the token immediately (shown only once)

3. Provide the token when prompted by Claude.

4. Tokens expire - generate a new one if current token is old.

5. Check token permissions:
   - Token needs "File content" scope at minimum
   - For full access, include all scopes

**Prevention**
- Store Figma token securely (password manager)
- Set calendar reminder to refresh token periodically
- Use Figma Desktop MCP as primary (no token needed)

---

### 4.2 Rate Limiting

**Difficulty:** Medium | **Time to Fix:** 5-30 minutes (wait)

**Symptom**
Error messages like:
- "429 Too Many Requests"
- "Rate limit exceeded"
- "Slow down, too many requests"

**Cause**
Too many requests sent to Figma remote MCP in a short period.

**Fix**

1. Wait for rate limit to reset:
   - Usually 60 seconds to 5 minutes
   - Check response headers for exact wait time

2. Reduce request frequency:
   ```
   "Please extract design tokens more slowly, with pauses between requests"
   ```

3. Switch to Figma Desktop MCP (no rate limits):
   ```
   "Use the figma-desktop MCP instead of the remote one"
   ```

4. Batch requests more efficiently:
   ```
   "Extract all design tokens in a single request rather than
   multiple requests for individual tokens"
   ```

**Prevention**
- Use Figma Desktop MCP as primary
- Batch extractions (all tokens at once, not individually)
- Add pauses between large operations
- Monitor for 429 responses and back off

---

### 4.3 Token Expiration

**Difficulty:** Easy | **Time to Fix:** 5 minutes

**Symptom**
MCP worked previously but now fails with:
- "Token expired"
- "Invalid token"
- Sudden authentication errors after working fine

**Cause**
Figma personal access tokens can expire or be revoked.

**Fix**

1. Generate a new token:
   - Figma Settings > Personal access tokens
   - Generate new token
   - Provide to Claude when prompted

2. Check if token was revoked:
   - Figma Settings > Personal access tokens
   - Look for your token in the list
   - If missing, it was deleted

3. Use Figma Desktop MCP instead (no token needed).

**Prevention**
- Note token creation date
- Regenerate tokens every 30-90 days
- Prefer Figma Desktop MCP (more reliable)

---

### 4.4 Network Connectivity

**Difficulty:** Medium | **Time to Fix:** 5-15 minutes

**Symptom**
Error messages like:
- "Network error"
- "Connection timed out"
- "DNS resolution failed"
- "SSL certificate error"

**Cause**
Network issues preventing connection to mcp.figma.com.

**Fix**

1. Check internet connectivity:
   ```bash
   curl -s https://www.figma.com | head -c 100
   ```

2. Check DNS resolution:
   ```bash
   nslookup mcp.figma.com
   ```
   Expected: IP address returned

3. Check if on corporate network with restrictions:
   - Try from personal network
   - Contact IT about mcp.figma.com access

4. Check proxy settings:
   - Corporate proxies may block or interfere
   - Configure proxy for curl/requests if needed

5. Use Figma Desktop MCP (bypasses network issues):
   - Desktop MCP uses local connection
   - No external network required

**Prevention**
- Test connectivity before starting long conversions
- Have Figma Desktop as backup
- Document network requirements for project

---

## 5. Playwright MCP Issues

### 5.1 Browser Not Installed

**Difficulty:** Easy | **Time to Fix:** 5-10 minutes

**Symptom**
Error messages like:
- "Browser not found"
- "Chromium is not installed"
- "browserType.launch: Executable doesn't exist"
- `browser_navigate` fails immediately

**Cause**
Playwright browsers are not installed on the system.

**Fix**

1. Run the setup script:
   ```bash
   ./scripts/setup-playwright.sh
   ```

2. Or install browsers manually:
   ```bash
   npx playwright install chromium
   npx playwright install firefox
   npx playwright install webkit
   ```

3. Install all browsers at once:
   ```bash
   npx playwright install
   ```

4. On Linux, install system dependencies too:
   ```bash
   npx playwright install-deps
   ```

5. Verify installation:
   ```bash
   npx playwright --version
   ```
   Expected: Version number (e.g., "1.40.0")

**Prevention**
- Run `./scripts/setup-playwright.sh` during project setup
- Document browser installation in project README
- Include in CI/CD setup scripts

---

### 5.2 Page Navigation Failed

**Difficulty:** Medium | **Time to Fix:** 5-15 minutes

**Symptom**
Error messages like:
- "Navigation failed"
- "Page not found"
- "ERR_CONNECTION_REFUSED"
- "net::ERR_NAME_NOT_RESOLVED"

**Cause**
The target URL is unreachable, invalid, or the page failed to load.

**Fix**

1. Verify URL is accessible:
   ```bash
   curl -I http://localhost:8080
   ```
   Expected: HTTP 200 response

2. Check if target server is running:
   ```bash
   # For Docker WordPress
   docker compose ps

   # For local dev server
   ps aux | grep -E "php|node|nginx"
   ```

3. Wait for slow servers:
   ```
   "Navigate to the page with a 30 second timeout"
   ```

4. Check URL format:
   - Include protocol: `http://` or `https://`
   - Verify hostname/port are correct

5. For localhost issues, try different addresses:
   - `http://localhost:8080`
   - `http://127.0.0.1:8080`
   - `http://host.docker.internal:8080` (from Docker)

**Prevention**
- Start target server before running browser tests
- Use health check endpoints to verify server is ready
- Include server startup in test setup

---

### 5.3 Screenshot Capture Failed

**Difficulty:** Medium | **Time to Fix:** 5-10 minutes

**Symptom**
Error messages like:
- "Screenshot failed"
- "Cannot capture screenshot"
- "Page is not ready for screenshot"
- Blank or partial screenshots

**Cause**
Page hasn't fully loaded, or there's a rendering issue.

**Fix**

1. Wait for page to fully load:
   ```
   "Navigate to the page and wait for it to fully load before taking a screenshot"
   ```

2. Add explicit wait:
   ```
   "Wait 5 seconds after navigation before capturing screenshot"
   ```

3. Check for page errors:
   ```
   "Check the browser console for any JavaScript errors on the page"
   ```

4. Try a simpler page first:
   ```
   "Capture a screenshot of a simple HTML page to test"
   ```

5. Increase timeout settings:
   - Default may be too short for complex pages
   - WordPress sites may need 10-30 seconds

**Prevention**
- Ensure pages are optimized for loading speed
- Add explicit waits for dynamic content
- Test screenshot capture on staging before production

---

### 5.4 Timeout Errors

**Difficulty:** Medium | **Time to Fix:** 5-15 minutes

**Symptom**
Error messages like:
- "Timeout 30000ms exceeded"
- "Navigation timeout"
- "Waiting for selector timed out"
- Operations hang and then fail

**Cause**
The operation took longer than the allowed timeout period.

**Fix**

1. Increase timeout for slow operations:
   ```
   "Navigate with a 60 second timeout"
   ```

2. Check if page is actually loading:
   ```bash
   curl -o /dev/null -s -w '%{time_total}\n' http://localhost:8080
   ```
   If this takes >10 seconds, the page is slow.

3. Optimize the target page:
   - Reduce JavaScript bundle size
   - Optimize images
   - Fix slow database queries

4. Use headless mode (faster):
   - Already configured in .mcp.json with `--headless`

5. Check system resources:
   - Close unnecessary applications
   - Ensure sufficient RAM for browser

**Prevention**
- Test with timeouts that match page complexity
- Monitor page load times
- Optimize pages for performance

---

### 5.5 Server Not Starting

**Difficulty:** Medium | **Time to Fix:** 10-15 minutes

**Symptom**
Playwright MCP tools are unavailable:
- Claude says Playwright tools don't exist
- MCP command fails to start
- "Command not found" or similar errors

**Cause**
The Playwright MCP server command failed to execute.

**Fix**

1. Check Node.js version:
   ```bash
   node -v
   ```
   Required: v20.0.0 or higher

2. Install Node.js if needed:
   - Windows: `winget install OpenJS.NodeJS.LTS`
   - macOS: `brew install node`
   - Linux: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs`

3. Verify npx works:
   ```bash
   npx --version
   ```

4. Test Playwright MCP directly:
   ```bash
   npx @playwright/mcp@latest --help
   ```

5. Check .mcp.json configuration:
   ```json
   {
     "playwright": {
       "command": "cmd",
       "args": ["/c", "npx", "@playwright/mcp@latest", "--headless"]
     }
   }
   ```

6. Clear npm cache and retry:
   ```bash
   npm cache clean --force
   npx @playwright/mcp@latest --help
   ```

**Prevention**
- Maintain Node.js 22.12+ in development environment
- Run `./scripts/check-mcp.sh` regularly
- Document Node.js version requirements

---

### 5.6 Different Browser Engines

**Difficulty:** Easy | **Time to Fix:** 2 minutes

**Symptom**
Need to test in Firefox or WebKit instead of Chromium:
- Default browser is always Chromium
- Need cross-browser testing
- Safari-specific testing required

**Cause**
Playwright MCP defaults to Chromium. Other browsers require configuration.

**Fix**

1. Set browser via environment variable:
   ```bash
   # In .mcp.json or before running
   PLAYWRIGHT_MCP_BROWSER=firefox
   PLAYWRIGHT_MCP_BROWSER=webkit
   ```

2. Or specify in request:
   ```
   "Use Firefox for this browser test"
   "Test this page in WebKit (Safari engine)"
   ```

3. Use cross-browser test script:
   ```bash
   ./scripts/cross-browser-test.sh chromium http://localhost:8080
   ```

4. Ensure all browsers are installed:
   ```bash
   npx playwright install
   ```

**Prevention**
- Install all browser engines during setup
- Use cross-browser testing script for comprehensive testing
- Document which browsers are needed for testing

---

## 6. Chrome DevTools MCP Issues

**Note:** Chrome DevTools MCP is not currently configured in this project. These sections are placeholders for future implementation.

### 6.1 Cannot Connect to Chrome

**Difficulty:** Medium | **Time to Fix:** 10 minutes

**Symptom**
Chrome DevTools MCP fails to connect:
- "Cannot connect to Chrome"
- "No Chrome instance found"
- Connection timeout to debugging port

**Cause**
Chrome is not running with remote debugging enabled.

**Fix**

1. Launch Chrome with debugging port:
   ```bash
   # Windows
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222

   # macOS
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

   # Linux
   google-chrome --remote-debugging-port=9222
   ```

2. Verify Chrome is listening:
   ```bash
   curl http://localhost:9222/json
   ```
   Expected: JSON with tab information

3. Check no other Chrome instance is running:
   - Close all Chrome windows first
   - Then launch with debugging flag

**Prevention**
- Create a shortcut with debugging flag
- Use a separate Chrome profile for debugging
- Document debugging setup in project docs

---

### 6.2 Page Not Responding

**Difficulty:** Medium | **Time to Fix:** 5-10 minutes

**Symptom**
- DevTools commands timeout
- Page appears frozen
- Actions don't complete

**Cause**
The target page has JavaScript errors, is stuck in a loop, or Chrome is overloaded.

**Fix**

1. Check page in regular Chrome:
   - Open the same URL in a normal Chrome window
   - Check Developer Tools console for errors

2. Close unnecessary Chrome tabs (reduces memory pressure).

3. Restart Chrome with debugging:
   - Close all Chrome instances
   - Relaunch with debugging port

4. Try a simpler page to isolate the issue.

**Prevention**
- Monitor Chrome memory usage
- Test with minimal page first
- Close unused tabs before DevTools sessions

---

### 6.3 Lighthouse Audit Failed

**Difficulty:** Medium | **Time to Fix:** 10-15 minutes

**Symptom**
- Lighthouse audit errors out
- Incomplete audit results
- "Lighthouse encountered an error"

**Cause**
Page didn't load properly, or Chrome ran out of resources during audit.

**Fix**

1. Ensure page is loaded before audit:
   - Navigate to page first
   - Wait for full load
   - Then run Lighthouse

2. Increase Chrome memory:
   - Close other tabs and applications
   - Chrome needs significant RAM for Lighthouse

3. Try auditing a simpler page first.

4. Check page isn't redirecting during audit.

**Prevention**
- Run Lighthouse on pages that are fully functional
- Give page time to load before audit
- Monitor Chrome resource usage

---

## 7. Core Memory MCP Issues

**Note:** Core Memory MCP is not currently configured in this project. These sections are placeholders for future implementation.

### 7.1 Connection Issues

**Difficulty:** Medium | **Time to Fix:** 10 minutes

**Symptom**
Core Memory MCP fails to connect or initialize.

**Cause**
Server not configured or not running.

**Fix**
Check .mcp.json for Core Memory configuration. If not present, the server is not configured for this project.

---

### 7.2 Memory Search Failures

**Difficulty:** Medium | **Time to Fix:** 5-10 minutes

**Symptom**
Memory search returns no results or errors.

**Cause**
Memory store is empty or query syntax is incorrect.

**Fix**
Verify memory has been populated and query format is correct for the memory system being used.

---

## 8. General MCP Debugging

### 8.1 Checking MCP Server Logs

**Difficulty:** Medium | **Time to Fix:** 5-10 minutes

**Symptom**
MCP operations fail with unclear errors. Need more debugging information.

**Fix**

1. Check Claude Code output for MCP-related messages:
   - Look for tool call results
   - Check for error messages in responses

2. For Figma Desktop, check Figma's console:
   - Figma > Help > Show Logs (if available)
   - Or check system logs for Figma process

3. For Playwright, run with verbose logging:
   ```bash
   DEBUG=pw:api npx @playwright/mcp@latest --headless
   ```

4. Check system logs:
   ```bash
   # Windows Event Viewer
   eventvwr.msc

   # macOS Console
   open -a Console

   # Linux
   journalctl -f
   ```

**Prevention**
- Enable verbose logging during debugging
- Document error patterns for future reference

---

### 8.2 Restarting MCP Servers

**Difficulty:** Easy | **Time to Fix:** 2-5 minutes

**Symptom**
MCP server is stuck or behaving unexpectedly.

**Fix**

1. **Restart Figma Desktop MCP:**
   - Close Figma Desktop completely
   - Wait 5 seconds
   - Reopen Figma Desktop
   - Open your design file
   - Enable Dev Mode
   - Verify: `curl http://127.0.0.1:3845/mcp`

2. **Restart Playwright MCP:**
   - The Playwright MCP starts on-demand
   - Kill any stuck Playwright processes:
     ```bash
     # Windows
     taskkill /F /IM node.exe /T

     # macOS/Linux
     pkill -f playwright
     ```
   - Next MCP call will restart it

3. **Restart all MCP connections:**
   - Restart Claude Code session
   - This reinitializes all MCP connections

**Prevention**
- Restart MCP servers at start of long sessions
- Monitor for degraded performance

---

### 8.3 Testing MCP Connectivity

**Difficulty:** Easy | **Time to Fix:** 2 minutes

**Symptom**
Unsure if MCP servers are working correctly.

**Fix**

1. Run the validation script:
   ```bash
   ./scripts/check-mcp.sh
   ```

2. Manual connectivity tests:
   ```bash
   # Figma Desktop
   curl -s http://127.0.0.1:3845/mcp | head -c 100

   # Figma Remote
   curl -s https://mcp.figma.com/mcp | head -c 100

   # Playwright
   npx @playwright/mcp@latest --version 2>&1 || echo "Not available"
   ```

3. Expected outputs:
   - Figma: JSON response
   - Playwright: Version number or help text

**Prevention**
- Run `./scripts/check-mcp.sh` at session start
- Add to pre-conversion checklist

---

### 8.4 Handling MCP Timeouts

**Difficulty:** Medium | **Time to Fix:** 5-15 minutes

**Symptom**
MCP operations timeout:
- "Request timed out"
- Operations hang indefinitely
- Partial results returned

**Cause**
Operations taking longer than default timeout, usually due to:
- Slow network
- Large files
- Complex operations
- Overloaded servers

**Fix**

1. Increase timeout for specific operations:
   ```
   "Extract design tokens with a 2-minute timeout"
   ```

2. Break large operations into smaller pieces:
   ```
   "Extract colors only first, then typography, then spacing"
   ```

3. Check network connectivity:
   ```bash
   ping figma.com
   ```

4. Reduce operation complexity:
   - Extract from single page, not entire file
   - Target specific nodes, not entire frames

5. Try during off-peak hours if using remote MCP.

**Prevention**
- Know your file sizes and plan accordingly
- Use local MCP (Figma Desktop) for large operations
- Break complex extractions into phases

---

### 8.5 Fallback Procedures When MCP Unavailable

**Difficulty:** Medium | **Time to Fix:** varies

**Symptom**
MCP is completely unavailable and you need to continue work.

**Fix**

1. **If Figma Desktop MCP unavailable:**
   - Switch to Figma Remote MCP:
     ```
     "Use the remote Figma MCP at mcp.figma.com instead"
     ```
   - Or use manual extraction:
     - Screenshot the design
     - Copy values from Figma's Inspect panel
     - Manually create theme.json

2. **If all Figma MCP unavailable:**
   - Export design specs from Figma manually
   - Use screenshot-based approach:
     ```
     "I'll provide screenshots. Extract design tokens from visual inspection."
     ```

3. **If Playwright MCP unavailable:**
   - Use manual browser testing
   - Take screenshots manually
   - Use curl for basic page checking:
     ```bash
     curl -o page.html http://localhost:8080
     ```

4. **Document the workaround used for future reference.**

**Prevention**
- Have multiple MCP options configured (desktop + remote)
- Know manual fallback procedures
- Keep Figma Desktop updated

---

## 9. MCP Validation Script

The `./scripts/check-mcp.sh` script validates all MCP server configurations.

### Usage

```bash
# Run full validation
./scripts/check-mcp.sh

# Expected output:
# ====================================
# MCP Server Validation
# ====================================
#
# Checking .mcp.json configuration...
# [PASS] .mcp.json exists and is valid JSON
#
# Checking Figma Desktop MCP (http://127.0.0.1:3845/mcp)...
# [PASS] Figma Desktop MCP is responding
#
# Checking Figma Remote MCP (https://mcp.figma.com/mcp)...
# [PASS] Figma Remote MCP is reachable
#
# Checking Playwright MCP...
# [PASS] Playwright is installed
# [PASS] Chromium browser is available
#
# ====================================
# Summary: All MCP servers operational
# ====================================
```

### Exit Codes

- `0` - All checks passed
- `1` - One or more critical failures

### What It Checks

1. **.mcp.json validation**
   - File exists
   - Valid JSON syntax
   - Required server configurations present

2. **Figma Desktop MCP**
   - Server responding on port 3845
   - Returns valid response

3. **Figma Remote MCP**
   - HTTPS endpoint reachable
   - DNS resolution works

4. **Playwright MCP**
   - Node.js available
   - npx works
   - Playwright installed
   - Browsers available

---

## Related Documentation

- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - General troubleshooting including MCP sections
- [COMMON-FAILURES-FIXES.md](./COMMON-FAILURES-FIXES.md) - Figma-to-FSE workflow failures
- [.mcp.json](../.mcp.json) - MCP server configuration
- [scripts/setup-playwright.sh](../scripts/setup-playwright.sh) - Playwright browser setup
- [scripts/check-mcp.sh](../scripts/check-mcp.sh) - MCP validation script

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-14 | Initial release with comprehensive MCP troubleshooting |

---

**Maintainer:** Claude Code WordPress Template Team
**Last Updated:** 2026-03-14
