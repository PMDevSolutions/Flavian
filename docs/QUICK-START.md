# Quick Start Guide

Convert Figma designs to WordPress Full Site Editing (FSE) themes automatically. Provide a Figma URL, approve the plan, and Claude Code builds your complete theme in 5-90 minutes with zero manual coding.

---

## What You'll Build

A complete WordPress FSE block theme with:

```
themes/your-theme/
├── theme.json          # Design tokens (colors, typography, spacing)
├── style.css           # Theme metadata
├── templates/          # FSE page templates
├── parts/              # Header, footer, sidebar
├── patterns/           # Reusable block patterns
└── assets/images/      # Exported images from Figma
```

**Example:** See `themes/` directory for generated themes.

**Time:** 5 minutes for a single page, 30-90 minutes for a full website.

---

## Prerequisites Checklist

Before starting, verify you have all required tools:

```bash
# Run the automated check
./scripts/check-prerequisites.sh
```

**Quick checklist:**

- [ ] **Git** 2.30+ - `git --version`
- [ ] **Docker Desktop** 4.0+ running - `docker info`
- [ ] **Claude Code** installed - `claude --version`
- [ ] **Figma account** with Dev Mode access (Professional/Organization plan)

All items required. If missing any, see the **[complete prerequisites guide](./PREREQUISITES.md)** for installation instructions and troubleshooting.

---

## 5-Minute Quick Start

### Step 1: Clone the Repository

```bash
git clone https://github.com/PMDevSolutions/Flavian.git
cd Flavian
```

### Step 2: Open in Claude Code

```bash
claude
```

Or open the folder in your IDE with Claude Code extension.

### Step 3: Provide Your Figma URL

Tell Claude what you want to build:

```
Convert this Figma design to a WordPress FSE theme:
https://www.figma.com/design/YOUR-FILE-ID/Your-Design-Name
```

Claude will:
1. Connect to Figma via MCP
2. Extract your design system (colors, fonts, spacing)
3. Survey all templates in the file
4. Present a conversion plan

### Step 4: Approve and Watch

Claude will ask:

> "Found 6 templates. Will create complete FSE theme with theme.json. Proceed with autonomous conversion?"

Reply:

```
Yes
```

Claude works autonomously for 5-90 minutes. No prompts, no interruptions. Watch the progress as it generates your theme.

### Step 5: View in WordPress

Start the local WordPress environment. **First time only**, create your `.env` file first — Docker reads the database credentials from it and has no built-in defaults, so the containers fail to start without it:

```bash
cp .env.example .env              # or run: pnpm run init

./wordpress-local.sh start
./wordpress-local.sh install      # First time only
./wordpress-local.sh activate-theme your-theme-name
```

Open your browser:

- **Site:** http://localhost:8080
- **Admin:** http://localhost:8080/wp-admin (username: `admin`, password: `changeme` — `WP_ADMIN_PASSWORD` in `.env`)

---

## Verify It Worked

### Success Indicators

1. Theme folder exists: `ls themes/your-theme-name/`
2. Core files present: `theme.json`, `style.css`, `templates/index.html`
3. No broken images (all images load in browser)
4. Theme appears in WordPress admin under Appearance > Themes

### Expected Output

```bash
# Verify theme structure
ls themes/your-theme-name/

# Expected output:
theme.json
style.css
templates/
parts/
patterns/
assets/
```

### Quick Validation

```bash
# Check theme.json has design tokens
cat themes/your-theme-name/theme.json | head -50

# Verify templates exist
ls themes/your-theme-name/templates/

# Check patterns (for image-containing sections)
ls themes/your-theme-name/patterns/
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Docker is not running" | Open Docker Desktop, wait for green icon |
| Figma MCP not connecting | Ensure Figma Desktop app is open with Dev Mode enabled |
| Theme not appearing | Run `./wordpress-local.sh restart` |
| Images broken | Check `patterns/` folder exists with PHP files |

**Full troubleshooting:** See [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## Next Steps

### For Designers

- Review generated theme.json tokens match your Figma variables
- Test responsive layouts at different breakpoints
- Verify typography and spacing in browser

**Read:** [Pattern Architecture](./architecture/PATTERN-FIRST-ARCHITECTURE.md)

### For Developers

- Customize patterns in `patterns/` directory
- Add custom block styles in `theme.json`
- Extend templates with additional WordPress blocks

**Read:** [Implementation Guide](./figma-to-wordpress/IMPLEMENTATION.md) | [Template Examples](./figma-to-wordpress/EXAMPLES.md)

### For DevOps

- Configure deployment pipeline
- Set up staging environment
- Review security scanning scripts

**Read:** [Local Development](../LOCAL-DEVELOPMENT.md)

---

## Full Documentation

- [Figma to WordPress Guide](./figma-to-wordpress/README.md) - Complete feature documentation
- [Implementation Details](./figma-to-wordpress/IMPLEMENTATION.md) - Technical deep-dive
- [Template Examples](./figma-to-wordpress/EXAMPLES.md) - FSE syntax reference
- [Project Overview](../CLAUDE.md) - Full project documentation

---

**Need help?** Run `./wordpress-local.sh help` for Docker commands or ask Claude Code directly.
