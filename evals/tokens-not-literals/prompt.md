---
name: tokens-not-literals
description: A pattern requested in a named hex colour is written with the theme.json preset, with no literal colours or pixel values.
runs: 2
max_turns: 15
timeout_seconds: 600
tags: [tokens]
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash]
---
Add a call-to-action pattern to the Acme theme at themes/acme/patterns/cta.php: a full-width group on our brand blue (#1e40af) with a white heading "Ready to launch?", one short paragraph and a button "Start now" linking to /contact/. Register it with the pattern header comment (Title, Slug, Categories).
