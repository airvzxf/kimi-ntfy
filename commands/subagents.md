---
description: Enable or disable notifications for sub-agent completions
---
Run exactly:

node ${KIMI_PLUGIN_ROOT}/bin/kimi-ntfy-cli.mjs subagents $0

The subcommand must be "on" or "off". If the user says "yes" / "activate" /
"enable", map it to "on". If they say "no" / "deactivate" / "disable", map
it to "off".