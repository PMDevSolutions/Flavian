# Prerequisites Validation Criteria

This document defines validation criteria for all prerequisites required to use this template.

---

## Validation Categories

### Category 1: Required Software
Items that MUST be installed and working before using this template.

| Item | Type | Validation Method |
|------|------|-------------------|
| Git | CLI Tool | Command execution + version check |
| Docker Desktop | Application | Command execution + daemon status |
| Claude Code | CLI Tool | Command execution |

### Category 2: Required Accounts & Access
External accounts and access permissions needed for full functionality.

| Item | Type | Validation Method |
|------|------|-------------------|
| Figma Account | Service Account | Manual verification (login) |
| Figma Dev Mode | Feature Access | Manual verification (UI check) |
| Anthropic Account | Service Account | Claude Code auth status |
| GitHub Account | Service Account | `gh auth status` or manual |

### Category 3: Optional Software
Items that enhance the experience but are not strictly required.

| Item | Type | Validation Method |
|------|------|-------------------|
| WP-CLI | CLI Tool | Command execution + version |
| Node.js | Runtime | Command execution + version |
| PHP | Runtime | Command execution + version |
| Composer | Package Manager | Command execution + version |
| GitHub CLI | CLI Tool | Command execution + auth status |
| Chrome/Firefox | Browser | Manual verification |
| VS Code | Editor | Manual verification |

### Category 4: System Requirements
Hardware and OS requirements for optimal performance.

| Item | Type | Validation Method |
|------|------|-------------------|
| RAM | Hardware | System info query |
| Disk Space | Hardware | Disk usage query |
| Operating System | Software | OS detection |

---

## Detailed Validation Specifications

### Git

**Required:** Yes

**Minimum Version:** 2.30.0 (for modern Git features)

**Verification Command:**
```bash
git --version
```

**Expected Output Pattern:**
```
git version 2.x.x
```

**Validation Logic:**
1. Command must execute successfully (exit code 0)
2. Version number must be >= 2.30.0
3. Parse version from output: `git version X.Y.Z`

**Install Links:**
- Windows: https://git-scm.com/download/win
- macOS: `brew install git` or https://git-scm.com/download/mac
- Linux: `sudo apt install git` or `sudo dnf install git`

---

### Docker Desktop

**Required:** Yes

**Minimum Version:** 4.0.0

**Verification Commands:**
```bash
# Check Docker CLI
docker --version

# Check Docker daemon is running
docker info
```

**Expected Output Pattern:**
```
Docker version 2x.x.x, build xxxxxxx
```

**Validation Logic:**
1. `docker --version` must execute successfully
2. `docker info` must not show connection errors
3. Docker daemon must be running (no "Cannot connect" messages)

**Install Links:**
- Windows: https://docs.docker.com/desktop/install/windows-install/
- macOS: https://docs.docker.com/desktop/install/mac-install/
- Linux: https://docs.docker.com/desktop/install/linux-install/

**Additional Notes:**
- Windows: Enable WSL2 backend for best performance
- All platforms: Allocate at least 4GB RAM in Docker settings

---

### Claude Code

**Required:** Yes

**Minimum Version:** Current (auto-updates)

**Verification Command:**
```bash
claude --version
```

**Expected Output Pattern:**
```
claude-code x.x.x
```

**Validation Logic:**
1. Command must execute successfully (exit code 0)
2. Version output confirms installation

**Install Links:**
- All platforms: https://claude.ai/code
- Install via: `npm install -g @anthropic-ai/claude-code`

---

### Figma Dev Mode Access

**Required:** Yes (for Figma-to-WordPress conversion)

**Minimum Version:** N/A (web service)

**Verification Method:** Manual

**Validation Steps:**
1. Log into Figma
2. Open any design file
3. Press `Shift + D` or click "Developer" in toolbar
4. If Dev Mode panel appears, access is confirmed

**Required Plan:**
- Professional or Organization Figma plan
- Free plans do not have Dev Mode

**Access Links:**
- Figma: https://www.figma.com/
- Plan comparison: https://www.figma.com/pricing/

---

### GitHub Account

**Required:** No (optional, for CI/CD and collaboration)

**Verification Commands:**
```bash
# If GitHub CLI is installed
gh auth status

# Alternative: SSH key test
ssh -T git@github.com
```

**Expected Output:**
```
Logged in to github.com as USERNAME
```

**Install Links:**
- GitHub: https://github.com/join
- GitHub CLI: https://cli.github.com/

---

### WP-CLI

**Required:** No (optional, Docker includes WP-CLI internally)

**Minimum Version:** 2.8.0

**Verification Command:**
```bash
wp --version
```

**Expected Output Pattern:**
```
WP-CLI 2.x.x
```

**Validation Logic:**
1. Command must execute successfully
2. Version >= 2.8.0

**Install Links:**
- All platforms: https://wp-cli.org/#installing
- macOS: `brew install wp-cli`

---

### Node.js

**Required:** No (optional, for JavaScript tooling)

**Minimum Version:** 20.0.0 (LTS)

**Verification Command:**
```bash
node --version
```

**Expected Output Pattern:**
```
v20.x.x or higher
```

**Validation Logic:**
1. Command must execute successfully
2. Major version >= 20

**Install Links:**
- All platforms: https://nodejs.org/
- Version manager: https://github.com/nvm-sh/nvm

---

### PHP (Local)

**Required:** No (optional, Docker provides PHP)

**Minimum Version:** 8.1

**Verification Command:**
```bash
php --version
```

**Expected Output Pattern:**
```
PHP 8.x.x
```

**Validation Logic:**
1. Command must execute successfully
2. Major version >= 8, minor >= 1

**Install Links:**
- Windows: https://windows.php.net/download
- macOS: `brew install php`
- Linux: `sudo apt install php`

---

### Composer

**Required:** No (optional, for PHP dependency management)

**Minimum Version:** 2.0.0

**Verification Command:**
```bash
composer --version
```

**Expected Output Pattern:**
```
Composer version 2.x.x
```

**Install Links:**
- All platforms: https://getcomposer.org/download/

---

### GitHub CLI (gh)

**Required:** No (optional, for GitHub integration)

**Minimum Version:** 2.0.0

**Verification Commands:**
```bash
gh --version
gh auth status
```

**Expected Output Pattern:**
```
gh version 2.x.x
```

**Install Links:**
- All platforms: https://cli.github.com/

---

## System Requirements Specifications

### RAM

**Minimum:** 8 GB

**Recommended:** 16 GB

**Validation Command:**
```bash
# Linux/macOS
free -h | grep Mem

# Windows (PowerShell)
Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property capacity -Sum

# Cross-platform via Docker
docker info | grep "Total Memory"
```

**Notes:**
- Docker Desktop requires 4GB minimum
- Running WordPress + MySQL + phpMyAdmin requires ~2GB
- IDE and Claude Code require additional RAM

---

### Disk Space

**Minimum:** 10 GB free

**Recommended:** 20 GB free

**Validation Command:**
```bash
# Linux/macOS
df -h .

# Windows (PowerShell)
Get-PSDrive C
```

**Space Requirements:**
- Docker images: ~2GB
- WordPress installation: ~1GB
- Theme development: Variable (depends on images)
- Node modules (if using): ~500MB

---

### Operating System

**Supported:**
- Windows 10/11 (64-bit) with WSL2
- macOS 12.0+ (Monterey or later)
- Linux (Ubuntu 20.04+, Fedora 35+, or equivalent)

**Validation Command:**
```bash
# Linux/macOS
uname -a

# Windows
systeminfo | findstr /B /C:"OS Name" /C:"OS Version"
```

---

## Validation Result Format

The verification script outputs results in this format:

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

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All required prerequisites met |
| 1 | One or more required prerequisites missing |
| 2 | Script execution error |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-14 | Initial validation criteria |
