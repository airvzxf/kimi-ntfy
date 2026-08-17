---
description: Send a test notification to the configured topic
---
Run exactly:

node "${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-ntfy/bin/kimi-ntfy-cli.mjs" test

The path uses the documented Kimi Code managed-install location
(`$KIMI_CODE_HOME/plugins/managed/<id>/`); `KIMI_PLUGIN_ROOT` is only
injected for hook commands, not for slash commands.

Report the HTTP status code to the user. A 200 means everything is
wired correctly.