---
description: Switch the plugin language between English and Spanish
---
Run exactly this command, with no extra arguments:

node "${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-ntfy/bin/kimi-ntfy-cli.mjs" lang $ARGUMENTS

The path uses the documented Kimi Code managed-install location
(`$KIMI_CODE_HOME/plugins/managed/<id>/`); `KIMI_PLUGIN_ROOT` is only
injected for hook commands, not for slash commands.

Read the output. The success message is printed in the language that
was just set, so the user sees confirmation in the language they are
switching to.