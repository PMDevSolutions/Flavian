---
name: bad-hook-agent
description: Agent with hook pointing to missing script.
hooks:
  PreToolUse:
    - matcher: "Write"
      hooks:
        - type: command
          command: "./non-existent-script.sh"
---

Body text.
