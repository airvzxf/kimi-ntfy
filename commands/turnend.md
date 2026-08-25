---
description: Enable or disable notifications for end-of-turn (`Stop`) events
---
Run exactly this command, with no extra arguments:

node "${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-ntfy/bin/kimi-ntfy-cli.mjs" turnend $ARGUMENTS

The path uses the documented Kimi Code managed-install location
(`$KIMI_CODE_HOME/plugins/managed/<id>/`); `KIMI_PLUGIN_ROOT` is only
injected for hook commands, not for slash commands.

If the user says "yes" / "enable" / "activate", map the argument to
`on`. If they say "no" / "disable" / "deactivate", map the argument to
`off`. Set this to `off` when running long sub-agent chains so you do
not get a push every time a sub-agent (or the main agent) closes a
turn — keep `notifySessionEnd` on instead for the actual end-of-session
ping.
