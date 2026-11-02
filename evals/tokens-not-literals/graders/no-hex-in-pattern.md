---
type: regex
pattern: "#[0-9a-fA-F]{3,8}\\b"
match: not_contains
target:
  source: file
  path: themes/acme/patterns/cta.php
---
The pattern carries no literal hex colour; colours come from theme.json presets.
