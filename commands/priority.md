---
description: Override the ntfy priority level for all notifications
---
Run exactly this command, with no extra arguments:

node "${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-ntfy/bin/kimi-ntfy-cli.mjs" priority $ARGUMENTS

The path uses the documented Kimi Code managed-install location
(`$KIMI_CODE_HOME/plugins/managed/<id>/`); `KIMI_PLUGIN_ROOT` is only
injected for hook commands, not for slash commands.

The argument must be one of the five ntfy priority names (or one of the
aliases in parentheses):

- `min` (alias: `silent`) — no sound, no vibration
- `low` — no sound, no vibration
- `default` (alias: `normal`) — sound + vibration, default
- `high` — long burst, vibration, pop-over on Android 8+
- `urgent` (aliases: `max`, `critical`) — overrides Do Not Disturb

The level applies to every event. If you do not set one, the plugin uses
its per-event defaults (Stop=`default`, StopFailure=`high`,
SessionEnd=`low`, SubagentStop=`min`). Pass any valid level to override;
to revert to the per-event defaults, edit `kimi-ntfy-config.json` and
remove the `priority` field.

Map the user's wording to one of the five names. Common mappings
-:
  "no molestar" / "silencio" / "silenciosa" → `min` or `low`
  "normal" / "estándar" / "por defecto" → `default`
  "alta" / "urgente" / "importante" → `high` or `urgent`