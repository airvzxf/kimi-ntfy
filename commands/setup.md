---
description: Configure the ntfy topic, server, and token for kimi-ntfy
---
Run exactly this command, with no extra arguments:

node "${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-ntfy/bin/kimi-ntfy-cli.mjs" setup $ARGUMENTS

The path uses the documented Kimi Code managed-install location
(`$KIMI_CODE_HOME/plugins/managed/<id>/`); `KIMI_PLUGIN_ROOT` is only
injected for hook commands, not for slash commands, so the absolute path
is required here.

If the last lines show a JSON config, confirm to the user that the
setup is complete. If the process exited with code 2, show the error
and suggest a different topic.