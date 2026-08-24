# Prerequisites Checklist

Everything you need to use this template for Figma-to-WordPress FSE theme conversion.

**Quick check:** Run `./scripts/check-prerequisites.sh` to verify your environment automatically.

---

## 1. Required Software

These tools MUST be installed before using this template.

### Git

Version control for managing your theme development.

| | |
|---|---|
| **Minimum Version** | 2.30.0 |
| **Verify** | `git --version` |
| **Expected** | `git version 2.x.x` |

**Install:**
- **Windows:** https://git-scm.com/download/win
- **macOS:** `brew install git` or Xcode Command Line Tools
- **Linux:** `sudo apt install git` or `sudo dnf install git`

---

### Docker Desktop

Runs the local WordPress environment (WordPress + MySQL + phpMyAdmin).

| | |
|---|---|
| **Minimum Version** | 4.0.0 |
| **Verify Installation** | `docker --version` |
| **Verify Running** | `docker info` |
| **Expected** | `Docker version 2x.x.x` (no connection errors) |

**Install:**
- **Windows:** https://docs.docker.com/desktop/install/windows-install/
- **macOS:** https://docs.docker.com/desktop/install/mac-install/
- **Linux:** https://docs.docker.com/desktop/install/linux-install/

**Post-Install (Windows):**
1. Enable WSL2 backend (Settings > General > Use WSL2)
2. Allocate 4+ GB RAM (Settings > Resources)

**Post-Install (All):**
- Start Docker Desktop before running `./wordpress-local.sh`

---

### Claude Code

AI-powered development assistant that converts Figma designs to WordPress themes.

| | |
|---|---|
| **Minimum Version** | Current (auto-updates) |
| **Verify** | `claude --version` |
| **Expected** | `claude-code x.x.x` |

**Install:**
```bash
npm install -g @anthropic-ai/claude-code
```

Or download from: https://claude.ai/code

**Requirements:**
- Anthropic account (sign up at https://claude.ai/)
- Valid API access

---

### pnpm

Package manager for the project's Node tooling (init wizard, tests, GUI, conversion pipelines).

| | |
|---|---|
| **Required Version** | 9.x (project pins `pnpm@9.15.0`) |
| **Verify** | `pnpm --version` |
| **Expected** | `9.x.x` |

**Install:**
```bash
npm install -g pnpm@9
```

Or enable via Corepack (ships with Node.js): `corepack enable && corepack prepare pnpm@9.15.0 --activate`

**Note:** pnpm requires Node.js 22.12+ (see Node.js below).

---

## 2. Required Accounts & Access

External services needed for full functionality.

### Figma Account with Dev Mode

Required for converting Figma designs to WordPress themes.

| | |
|---|---|
| **Required Plan** | Professional or Organization |
| **Required Feature** | Dev Mode |
| **Verify** | Open Figma > Press `Shift + D` > Dev Mode panel appears |

**Get Access:**
1. Sign up: https://www.figma.com/
2. Upgrade to Professional: https://www.figma.com/pricing/
3. Enable Dev Mode in any design file

**Note:** Free Figma plans do NOT include Dev Mode. The template cannot extract design tokens without it.

---

### Anthropic Account

Required for Claude Code authentication.

| | |
|---|---|
| **Verify** | Claude Code authenticates successfully |
| **Sign Up** | https://claude.ai/ |

---

### GitHub Account (for CI/CD)

Required only if using GitHub for version control and deployment.

| | |
|---|---|
| **Verify** | `gh auth status` or `ssh -T git@github.com` |
| **Sign Up** | https://github.com/join |

**Note:** Optional if you only develop locally.

---

### Node.js

Required for Playwright MCP (browser automation and testing) configured in `.mcp.json`.

| | |
|---|---|
| **Minimum Version** | 22.12.0 (LTS) |
| **Verify** | `node --version` |
| **Expected** | `v22.12.0` or higher |

**Install:**
- **All platforms:** https://nodejs.org/
- **Version manager:** https://github.com/nvm-sh/nvm

---

## 3. Optional but Recommended

These tools enhance the development experience but are not required.

### WP-CLI

WordPress command-line interface. Useful for local WordPress management outside Docker.

| | |
|---|---|
| **Minimum Version** | 2.8.0 |
| **Verify** | `wp --version` |
| **Expected** | `WP-CLI 2.x.x` |

**Install:**
- **All platforms:** https://wp-cli.org/#installing
- **macOS:** `brew install wp-cli`

**Note:** Docker already includes WP-CLI internally. Install locally only if running WordPress outside Docker.

---

### GitHub CLI (gh)

Enables GitHub integration from command line (PRs, issues, etc.).

| | |
|---|---|
| **Minimum Version** | 2.0.0 |
| **Verify** | `gh --version` |
| **Expected** | `gh version 2.x.x` |

**Install:**
- **Windows:** `winget install GitHub.cli`
- **macOS:** `brew install gh`
- **Linux:** https://cli.github.com/

**Post-Install:**
```bash
gh auth login
```

---

### PHP (Local)

Required only if running WordPress without Docker or using PHP tools locally.

| | |
|---|---|
| **Minimum Version** | 8.1 |
| **Verify** | `php --version` |
| **Expected** | `PHP 8.x.x` |

**Install:**
- **Windows:** https://windows.php.net/download
- **macOS:** `brew install php`
- **Linux:** `sudo apt install php`

**Note:** Docker provides PHP internally. Install locally only for standalone PHP tools.

---

### Composer

PHP dependency manager. Required for PHP CodeSniffer and other PHP tools.

| | |
|---|---|
| **Minimum Version** | 2.0.0 |
| **Verify** | `composer --version` |
| **Expected** | `Composer version 2.x.x` |

**Install:**
- **All platforms:** https://getcomposer.org/download/

---

### Code Editor

Any editor works. Recommendations:

| Editor | Notes |
|--------|-------|
| VS Code | Claude Code extension available |
| Cursor | Built-in AI integration |
| PhpStorm | WordPress-specific features |

---

### Browser DevTools

For testing responsive layouts and debugging.

| Browser | DevTools Access |
|---------|-----------------|
| Chrome | `F12` or `Cmd+Option+I` |
| Firefox | `F12` or `Cmd+Option+I` |
| Edge | `F12` or `Cmd+Option+I` |
| Safari | Enable in Preferences > Advanced |

---

## 4. System Requirements

### Hardware

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **RAM** | 8 GB | 16 GB |
| **Disk Space** | 10 GB free | 20 GB free |
| **CPU** | 64-bit, 2+ cores | 64-bit, 4+ cores |

**Memory Breakdown:**
- Docker Desktop: 4 GB
- WordPress containers: 2 GB
- Claude Code + IDE: 2 GB

---

### Operating System

| OS | Supported Versions |
|----|-------------------|
| **Windows** | Windows 10 (build 19041+) or Windows 11 |
| **macOS** | macOS 12 (Monterey) or later |
| **Linux** | Ubuntu 20.04+, Fedora 35+, or equivalent |

**Windows Requirements:**
- WSL2 enabled (required for Docker Desktop)
- Enable: Settings > Apps > Optional Features > Windows Subsystem for Linux

---

## 5. Verification Script

Run this script to check all prerequisites automatically:

```bash
./scripts/check-prerequisites.sh
```

**Output Example:**
```
=== Prerequisites Check ===

REQUIRED SOFTWARE
-----------------
[PASS] Git 2.43.0 (minimum: 2.30.0)
[PASS] Docker 25.0.3 (daemon running)
[PASS] Claude Code 1.0.0

REQUIRED ACCOUNTS
-----------------
[INFO] Figma Dev Mode - Manual verification required
[PASS] GitHub CLI authenticated as username

OPTIONAL SOFTWARE
-----------------
[PASS] WP-CLI 2.9.0
[SKIP] Node.js not installed
[SKIP] PHP not installed

SYSTEM REQUIREMENTS
-------------------
[PASS] RAM: 16 GB (minimum: 8 GB)
[PASS] Disk: 45 GB free (minimum: 10 GB)
[PASS] OS: Windows 11 (supported)

=== Summary ===
Required: 3/3 passed
Optional: 1/3 installed
System: 3/3 passed

Ready to use this template: YES
```

---

## Quick Install Commands

### Windows (PowerShell/Scoop)

```powershell
# Install Scoop package manager
irm get.scoop.sh | iex

# Install required tools
scoop install git
winget install Docker.DockerDesktop

# Install optional tools
winget install GitHub.cli
scoop install nodejs php composer
```

### macOS (Homebrew)

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required tools
brew install git
brew install --cask docker

# Install optional tools
brew install gh node php composer wp-cli
```

### Linux (Ubuntu/Debian)

```bash
# Install required tools
sudo apt update
sudo apt install git

# Docker (follow official instructions)
# https://docs.docker.com/desktop/install/linux-install/

# Install optional tools
sudo apt install nodejs npm php composer
# GitHub CLI: https://cli.github.com/
```

---

## Troubleshooting

### "Docker is not running"

**Solution:**
1. Open Docker Desktop application
2. Wait for the green "Running" status
3. Retry your command

### "git: command not found"

**Solution:**
1. Install Git (see section above)
2. Restart your terminal
3. Verify: `git --version`

### "Figma MCP not connecting"

**Solution:**
1. Open Figma Desktop app
2. Open a design file
3. Enable Dev Mode (Shift + D)
4. Check MCP server: http://127.0.0.1:3845/health

### "Permission denied" on scripts

**Solution (macOS/Linux):**
```bash
chmod +x ./scripts/check-prerequisites.sh
chmod +x ./wordpress-local.sh
```

---

## Next Steps

Once all prerequisites are met:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/PMDevSolutions/Flavian.git
   cd Flavian
   ```

2. **Create your `.env` file** (Docker DB credentials have no defaults, so this is required):
   ```bash
   cp .env.example .env       # or run: pnpm run init
   ```

3. **Start WordPress:**
   ```bash
   ./wordpress-local.sh start
   ./wordpress-local.sh install
   ```

4. **Begin conversion:**
   Open Claude Code and provide your Figma URL

See [QUICK-START.md](./QUICK-START.md) for the full getting started guide.

---

## Related Documentation

- [Quick Start Guide](./QUICK-START.md) - Get started in 5 minutes
- [Local Development](../LOCAL-DEVELOPMENT.md) - Docker setup details
- [Figma to WordPress](./figma-to-wordpress/README.md) - Full conversion guide
- [Validation Criteria](./PREREQUISITES.validation.md) - Technical validation specs

---

**Last Updated:** 2026-03-14
