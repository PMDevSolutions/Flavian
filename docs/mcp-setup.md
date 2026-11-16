# MCP Server Setup for Claude Desktop

**Step-by-step guide for connecting Flavian's MCP servers to the Claude Desktop app.**

**Last Updated:** 2026-11-16

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Locating the Configuration File](#locating-the-configuration-file)
3. [Configuring MCP Servers](#configuring-mcp-servers)
   - [Figma Desktop MCP (Local)](#1-figma-desktop-mcp-local)
   - [Figma Remote MCP (Cloud)](#2-figma-remote-mcp-cloud)
   - [Playwright MCP (Browser Automation)](#3-playwright-mcp-browser-automation)
4. [Complete Configuration Example](#complete-configuration-example)
5. [Verifying MCP Connections](#verifying-mcp-connections)
6. [Local Development vs Remote Server Scenarios](#local-development-vs-remote-server-scenarios)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before configuring MCP servers, ensure you have:

- **Claude Desktop** installed and running ([download](https://claude.ai/download))
- **Node.js 22.12+** installed (required for Playwright MCP)
- **npx** available (ships with Node.js)
- **Figma Desktop** installed (required for Figma Desktop MCP only)

Verify Node.js:

```bash
node -v   # Should print v18.x or higher
npx -v    # Should print a version number
```

---

## Locating the Configuration File

Claude Desktop reads MCP server configuration from `claude_desktop_config.json`. The file location depends on your OS:

| OS | Path |
|----|------|
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

### Opening the Config File

**From Claude Desktop (recommended):**

1. Open Claude Desktop
2. Click the **hamburger menu** (top-left) or go to **Settings**
3. Navigate to **Developer** > **Edit Config**
4. This opens `claude_desktop_config.json` in your default editor

**Manually (Windows):**

```bash
# Open in your editor
code "%APPDATA%\Claude\claude_desktop_config.json"

# Or navigate in Explorer
explorer "%APPDATA%\Claude"
```

**Manually (macOS):**

```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

If the file doesn't exist, create it with an empty MCP servers object:

```json
{
  "mcpServers": {}
}
```

---

## Configuring MCP Servers

Flavian uses three MCP servers. Only Playwright goes in `claude_desktop_config.json`, because that file launches local stdio servers and Figma publishes no npm package for its MCP server. Figma's server is built into the Figma desktop app (`http://127.0.0.1:3845/mcp`) or hosted by Figma (`https://mcp.figma.com/mcp`), the same two URLs the project's `.mcp.json` gives Claude Code. Do not add an `npx` entry for Figma.

### 1. Figma Desktop MCP (Local)

Connects to the Figma Desktop app running on your machine. This is the **preferred** Figma MCP server for development because it provides direct access to open files without authentication tokens.

**Requirements:**
- Figma desktop app, signed in with a Dev or Full seat on a paid plan (Professional, Education, Organization, Government or Enterprise)
- The desktop server switched on: open a file, switch to Dev Mode, and click **Enable desktop MCP server** in the MCP server section of the right sidebar

**Configuration:** nothing to install. The desktop app serves Streamable HTTP at `http://127.0.0.1:3845/mcp`, and the project's `.mcp.json` already points Claude Code's `figma-desktop` server at it (outside this repo: `claude mcp add --transport http figma-desktop http://127.0.0.1:3845/mcp`).

> **Claude Desktop:** this server is not reachable from Claude Desktop. `claude_desktop_config.json` only launches local stdio servers, and custom connectors connect from Anthropic's cloud, which cannot reach `127.0.0.1`. Use the Figma connector (section 2) in Claude Desktop, and run work that needs the desktop server in Claude Code.

### 2. Figma Remote MCP (Cloud)

Connects to Figma's hosted MCP server at `https://mcp.figma.com/mcp`. It needs no desktop app, Figma recommends it for most people, and it is how Claude Desktop reaches Figma.

**Requirements:**
- Internet connection
- A Figma account

**Configuration (Claude Desktop):** do not edit `claude_desktop_config.json`. Open **Customize > Connectors** and add **Figma** from the connector directory (made by Figma: https://claude.com/marketplace/connectors/figma). On Team and Enterprise plans an Owner adds it under **Organization settings > Connectors**.

**Configuration (Claude Code):** already in the project's `.mcp.json` as `figma` (`"type": "http"`, `"url": "https://mcp.figma.com/mcp"`). Outside this repo: `claude mcp add --transport http figma https://mcp.figma.com/mcp`, or Figma's own plugin, `claude plugin install figma@claude-plugins-official`.

**Authentication:** on first use you sign in to Figma in the browser (OAuth). There is no token to set, and Figma only accepts clients listed in its MCP catalog.

### 3. Playwright MCP (Browser Automation)

Enables browser automation for visual QA, screenshot capture, accessibility auditing, and end-to-end testing.

**Requirements:**
- Node.js 22.12+
- Playwright browsers installed (auto-installed on first run, or manually via `npx playwright install`)

**Configuration:**

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--headless"]
    }
  }
}
```

**Options:**

| Flag | Description |
|------|-------------|
| `--headless` | Run browsers without visible window (recommended for automation) |
| `--browser chromium` | Use Chromium (default) |
| `--browser firefox` | Use Firefox |
| `--browser webkit` | Use WebKit/Safari |

To use a headed browser (visible window), remove `--headless`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

> **Windows note:** If `npx` fails to resolve in Claude Desktop on Windows, wrap the command with `cmd`:
> ```json
> {
>   "command": "cmd",
>   "args": ["/c", "npx", "-y", "@playwright/mcp@latest", "--headless"]
> }
> ```

---

## Complete Configuration Example

Here is the full `claude_desktop_config.json` for Flavian. Playwright is the only server it launches; Figma comes from the Figma connector (see [Figma Remote MCP](#2-figma-remote-mcp-cloud)).

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--headless"]
    }
  }
}
```

> **Merging with existing servers:** If your `claude_desktop_config.json` already has other MCP servers configured, add the Flavian servers alongside them inside the existing `"mcpServers"` object. Do not create a second `"mcpServers"` key.

---

## Verifying MCP Connections

After saving your configuration, restart Claude Desktop for the changes to take effect.

### Step 1: Check the MCP Icon

1. Open a new conversation in Claude Desktop
2. Look for the **MCP tools icon** (hammer icon) in the chat input area
3. Click it to see the list of connected MCP servers and their available tools

If your servers appear in the list, they are connected.

### Step 2: Test Each Server

**Test Figma Desktop MCP (Claude Code only):**

Select a frame in Figma, then ask Claude: *"Use figma-desktop to get the metadata for my current selection"*

Expected: Claude calls `get_metadata` on `figma-desktop` and returns the frame's layers. (`whoami` is a remote-only tool, so it cannot test the desktop server.)

If this fails, verify:
- Figma Desktop is open, with a file open
- The desktop server is on (Dev Mode, MCP server section, **Enable desktop MCP server**)
- No firewall is blocking `127.0.0.1:3845`

**Test Figma Remote MCP (the Figma connector):**

Ask Claude: *"Use Figma to check who I am (whoami)"*

Expected: a Figma sign-in on first use, then your Figma user info.

**Test Playwright MCP:**

Ask Claude: *"Use Playwright to navigate to https://example.com and take a screenshot"*

Expected: Claude launches a browser, navigates to the page, and returns a screenshot.

### Step 3: Run the Validation Script (Claude Code Users)

If you also use Claude Code (CLI) with this project, run the validation script:

```bash
./scripts/check-mcp.sh
```

This checks all MCP server configurations and connectivity from the CLI side.

---

## Local Development vs Remote Server Scenarios

### Local Development (Recommended)

When developing on your local machine with WordPress running locally:

| Server | Use Case |
|--------|----------|
| **figma-desktop** | Primary Figma access in Claude Code - fastest, no auth tokens needed |
| **figma** (remote) | Fallback in Claude Code; the only Figma option in Claude Desktop (Figma connector) |
| **playwright** | Visual QA against `localhost` WordPress instance |

This is the default setup. All three servers run locally alongside your development environment.

### Remote/CI Server Scenario

When running on a remote server, CI pipeline, or headless environment:

| Server | Available? | Notes |
|--------|-----------|-------|
| **figma-desktop** | No | Requires Figma Desktop GUI |
| **figma** (remote) | Only after an interactive sign-in | OAuth only; Figma documents no personal-access-token option |
| **playwright** | Yes | Must use `--headless` flag |

**Figma in CI:** Figma's hosted server signs in with OAuth and documents no personal-access-token option, so a fresh headless runner cannot use it. In CI, read design data with the Figma REST API and a personal access token (Figma **Settings > Security > Personal access tokens**, sent as the `X-Figma-Token` header), or run the Figma steps locally. The community server `figma-developer-mcp` (Framelink) accepts a `FIGMA_API_KEY`, but its tools (`get_figma_data`, `download_figma_images`) are not the `get_design_context` / `get_variable_defs` / `get_screenshot` calls Flavian's agents make, and it sends usage telemetry unless `FRAMELINK_TELEMETRY=off` is set.

### Claude Code (CLI) vs Claude Desktop

The project's `.mcp.json` configures MCP servers for **Claude Code (CLI)**. Claude Desktop uses `claude_desktop_config.json` instead. The two files use slightly different formats:

| Feature | `.mcp.json` (Claude Code) | `claude_desktop_config.json` (Claude Desktop) |
|---------|--------------------------|----------------------------------------------|
| HTTP servers | `"type": "http", "url": "..."` | Not in this file; add remote servers as connectors (Customize > Connectors), which connect from Anthropic's cloud and cannot reach localhost |
| Stdio servers | `"command": "...", "args": [...]` | `"command": "...", "args": [...]` |
| Location | Project root | OS-specific app data directory |
| Scope | Per-project | Global (all conversations) |

Both files coexist without conflict. Configure each for its respective tool.

---

## Troubleshooting

### Server Not Appearing in Claude Desktop

**Symptoms:** MCP tools icon missing or server not listed.

**Fixes:**
1. **Restart Claude Desktop** after editing the config file
2. **Validate JSON syntax** - a single missing comma or bracket breaks all servers:
   ```bash
   # Windows
   python -m json.tool "%APPDATA%\Claude\claude_desktop_config.json"

   # macOS
   python3 -m json.tool ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```
3. **Check for duplicate keys** - each server name must be unique within `"mcpServers"`
4. **Review Claude Desktop logs** for error messages:
   - Windows: `%APPDATA%\Claude\logs\`
   - macOS: `~/Library/Logs/Claude/`

### Figma Desktop MCP: Connection Refused

**Symptoms:** `ECONNREFUSED 127.0.0.1:3845` or similar.

**Fixes:**
1. Open **Figma Desktop** (not the web app)
2. Enable **Dev Mode** - click the `</>` toggle in the toolbar
3. Open at least one file in Figma
4. Check that port 3845 is not blocked by a firewall:
   ```bash
   curl -s http://127.0.0.1:3845/mcp
   ```
5. Restart Figma Desktop if the port was recently freed

### Figma Remote MCP: Authentication Failed

**Symptoms:** 401 or 403 errors.

**Fixes:**
1. Re-authenticate via the OAuth prompt in Claude Desktop
2. If using a personal access token, verify it hasn't expired at **Figma > Account Settings**
3. Ensure the token has the required scopes (read access to files)

### Playwright MCP: Browser Not Found

**Symptoms:** `browserType.launch: Executable doesn't exist` or similar.

**Fixes:**
1. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```
2. Or install all browsers:
   ```bash
   npx playwright install
   ```
3. On Linux, install system dependencies:
   ```bash
   npx playwright install-deps
   ```

### Playwright MCP: npx Not Found on Windows

**Symptoms:** Claude Desktop can't find `npx`.

**Fix:** Wrap the command with `cmd`:

```json
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "@playwright/mcp@latest", "--headless"]
}
```

### General: MCP Server Timeout

**Symptoms:** Server takes too long to respond, or Claude gives up waiting.

**Fixes:**
1. First-time `npx` runs download packages - subsequent runs are faster
2. Check your internet connection (required for package downloads and remote Figma)
3. Try running the npx command manually in a terminal to see errors:
   ```bash
   npx -y @playwright/mcp@latest --headless
   ```

### Need More Help?

- **Detailed troubleshooting:** See [MCP-TROUBLESHOOTING.md](MCP-TROUBLESHOOTING.md) for in-depth debugging
- **Validation script:** Run `./scripts/check-mcp.sh` from the project root
- **Claude Desktop docs:** [Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers) (the config file) and [Custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) (remote servers)
