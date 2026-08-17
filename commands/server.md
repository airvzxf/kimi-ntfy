---
description: Point kimi-ntfy at a different ntfy server (self-hosted or ntfy.sh)
---
Run exactly this command, with no extra arguments:

node "${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-ntfy/bin/kimi-ntfy-cli.mjs" server $ARGUMENTS

The path uses the documented Kimi Code managed-install location
(`$KIMI_CODE_HOME/plugins/managed/<id>/`); `KIMI_PLUGIN_ROOT` is only
injected for hook commands, not for slash commands.

If the user just gave a URL with no token, the existing token (if any)
is preserved. If they explicitly want to clear the token, they should
pass an empty string after the URL.