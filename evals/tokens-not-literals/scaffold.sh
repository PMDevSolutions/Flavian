#!/usr/bin/env bash
# A Flavian-layout project: a root-level theme with a theme.json, in a git repo,
# whose palette has a brand-blue preset. The pattern is deliberately absent.
set -euo pipefail
git init -q -b main
mkdir -p themes/acme/templates themes/acme/parts
printf '/*\nTheme Name: Acme\nText Domain: acme\n*/\n' > themes/acme/style.css
cat > themes/acme/theme.json <<'JSON'
{
  "$schema": "https://schemas.wp.org/trunk/theme.json",
  "version": 3,
  "settings": {
    "color": { "palette": [
      { "slug": "brand-blue", "color": "#1e40af", "name": "Brand blue" },
      { "slug": "ink", "color": "#111827", "name": "Ink" },
      { "slug": "base", "color": "#ffffff", "name": "Base" }
    ] },
    "spacing": { "spacingSizes": [ { "slug": "40", "size": "1.5rem", "name": "Medium" }, { "slug": "60", "size": "3rem", "name": "Large" } ] },
    "typography": { "fontSizes": [ { "slug": "large", "size": "2rem", "name": "Large" }, { "slug": "medium", "size": "1.125rem", "name": "Medium" } ] }
  }
}
JSON
printf '<!-- wp:template-part {"slug":"header"} /-->\n<!-- wp:post-content /-->\n' > themes/acme/templates/index.html
printf '<!-- wp:site-title /-->\n' > themes/acme/parts/header.html
git add -A
git -c user.email=eval@example.com -c user.name=eval -c commit.gpgsign=false commit -q -m "scaffold"
