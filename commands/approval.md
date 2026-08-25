---
description: Enable or disable notifications when Kimi requests permission or approval
---
Run exactly this command, with no extra arguments:

node "${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-ntfy/bin/kimi-ntfy-cli.mjs" approval $ARGUMENTS

The path uses the documented Kimi Code managed-install location
(`$KIMI_CODE_HOME/plugins/managed/<id>/`); `KIMI_PLUGIN_ROOT` is only
injected for hook commands, not for slash commands.

If the user says "yes" / "enable" / "activate", map the argument to
`on`. If they say "no" / "disable" / "deactivate", map it to `off`.
