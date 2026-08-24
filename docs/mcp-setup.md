# MCP Server Setup for Claude Desktop

**Step-by-step guide for connecting Flavian's MCP servers to the Claude Desktop app.**

**Last Updated:** 2026-03-21

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

Flavian uses three MCP servers. Add each one inside the `"mcpServers"` object in your `claude_desktop_config.json`.

> **⚠️ Verified vs. unverified config.** The **verified** Figma MCP configuration is the
> HTTP transport in this project's `.mcp.json` (used by Claude Code): `figma-desktop` →
> `http://127.0.0.1:3845/mcp` and `figma` (remote) → `https://mcp.figma.com/mcp`. The
> `@anthropic-ai/figma-mcp-server` npm package shown in the Figma examples below is an
> **unverified** stdio wrapper (the package name is not confirmed to exist). If your
> Claude Desktop build supports HTTP/remote MCP servers, prefer the `.mcp.json` URLs
> above; otherwise treat the npx examples as a starting point and substitute a wrapper
> you have verified.

### 1. Figma Desktop MCP (Local)

Connects to the Figma Desktop app running on your machine. This is the **preferred** Figma MCP server for development because it provides direct access to open files without authentication tokens.

**Requirements:**
- Figma Desktop app installed and running
- Dev Mode enabled (click the `</>` toggle in Figma)

**Configuration:**

```json
{
  "mcpServers": {
    "figma-desktop": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/figma-mcp-server@latest", "--local"]
    }
  }
}
```

**How it works:** The Figma Desktop app exposes a local MCP endpoint at `http://127.0.0.1:3845/mcp` when Dev Mode is enabled. The MCP server package connects to this endpoint automatically.

> **Note:** If you use Claude Code (CLI), the project's `.mcp.json` configures this as an HTTP server pointing directly to `http://127.0.0.1:3845/mcp`. Claude Desktop uses the stdio-based wrapper package instead.

### 2. Figma Remote MCP (Cloud)

Connects to Figma's cloud MCP service. Use this as a **fallback** when Figma Desktop is not available, or when working with files you don't have open locally.

**Requirements:**
- Internet connection
- Figma account (authentication handled by Claude Desktop on first use)

**Configuration:**

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/figma-mcp-server@latest"]
    }
  }
}
```

**Authentication:** On first connection, Claude Desktop will prompt you to authenticate with Figma via OAuth. Follow the browser prompt to grant access.

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

Here is a full `claude_desktop_config.json` with all three Flavian MCP servers:

```json
{
  "mcpServers": {
    "figma-desktop": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/figma-mcp-server@latest", "--local"]
    },
    "figma": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/figma-mcp-server@latest"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--headless"]
    }
  }
}
```

> **Figma servers:** the `figma-desktop` / `figma` entries above use the unverified
> `@anthropic-ai/figma-mcp-server` package — see the warning under
> [Configuring MCP Servers](#configuring-mcp-servers). The verified transport is the HTTP
> config in `.mcp.json` (`http://127.0.0.1:3845/mcp`, `https://mcp.figma.com/mcp`).

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

**Test Figma Desktop MCP:**

Ask Claude: *"Use the Figma MCP to check who I am (whoami)"*

Expected: Claude calls `figma-desktop.whoami` and returns your Figma user info.

If this fails, verify:
- Figma Desktop is open
- Dev Mode is enabled (`</>` toggle)
- No firewall is blocking `127.0.0.1:3845`

**Test Figma Remote MCP:**

Ask Claude: *"Use the remote Figma MCP to get my account info"*

Expected: OAuth prompt on first use, then your Figma user info.

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
| **figma-desktop** | Primary Figma access - fastest, no auth tokens needed |
| **figma** (remote) | Fallback when Desktop unavailable or for shared files |
| **playwright** | Visual QA against `localhost` WordPress instance |

This is the default setup. All three servers run locally alongside your development environment.

### Remote/CI Server Scenario

When running on a remote server, CI pipeline, or headless environment:

| Server | Available? | Notes |
|--------|-----------|-------|
| **figma-desktop** | No | Requires Figma Desktop GUI |
| **figma** (remote) | Yes | Use as primary Figma access; requires auth token |
| **playwright** | Yes | Must use `--headless` flag |

**Remote Figma configuration with personal access token:**

For CI or headless environments where OAuth is not available, set the `FIGMA_PERSONAL_ACCESS_TOKEN` environment variable:

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/figma-mcp-server@latest"],
      "env": {
        "FIGMA_PERSONAL_ACCESS_TOKEN": "figd_xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Generate a personal access token at: **Figma > Account Settings > Personal access tokens**.

### Claude Code (CLI) vs Claude Desktop

The project's `.mcp.json` configures MCP servers for **Claude Code (CLI)**. Claude Desktop uses `claude_desktop_config.json` instead. The two files use slightly different formats:

| Feature | `.mcp.json` (Claude Code) | `claude_desktop_config.json` (Claude Desktop) |
|---------|--------------------------|----------------------------------------------|
| HTTP servers | `"type": "http", "url": "..."` | Not directly supported; use stdio wrapper |
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
- **Claude Desktop docs:** Check the [Claude Desktop MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp)
