---
description: Configure the ntfy topic, server, and token for kimi-ntfy
---
Run exactly this command with the arguments the user gave you, do not add
anything else:

node ${KIMI_PLUGIN_ROOT}/bin/kimi-ntfy-cli.mjs setup $ARGUMENTS

If the last lines show a JSON config, confirm to the user that the setup is
complete. If the process exited with code 2, show the error and suggest a
different topic.