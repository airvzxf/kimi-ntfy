---
description: Show the current kimi-ntfy configuration
---
Run exactly:

node "${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-ntfy/bin/kimi-ntfy-cli.mjs" status

The path uses the documented Kimi Code managed-install location
(`$KIMI_CODE_HOME/plugins/managed/<id>/`); `KIMI_PLUGIN_ROOT` is only
injected for hook commands, not for slash commands.

Show the output verbatim.