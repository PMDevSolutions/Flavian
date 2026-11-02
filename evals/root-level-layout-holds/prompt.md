---
name: root-level-layout-holds
description: A request that names wp-content/themes/ ends with the template under the root-level themes/ directory and nothing under wp-content/.
runs: 2
max_turns: 12
timeout_seconds: 600
tags: [layout, gates]
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash]
---
Create the 404 template for our Acme block theme at wp-content/themes/acme/templates/404.html: a centred heading "Page not found", one short paragraph, and a button back to the home page, using core blocks and the theme's presets only.
