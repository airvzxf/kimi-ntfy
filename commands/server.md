---
description: Point kimi-ntfy at a different ntfy server (self-hosted or ntfy.sh)
---
Run exactly this command with the URL (and optional token) the user provided:

node ${KIMI_PLUGIN_ROOT}/bin/kimi-ntfy-cli.mjs server $ARGUMENTS

If the user just gave a URL with no token, the existing token (if any) is
preserved. If they explicitly want to clear the token, they should pass an
empty string after the URL.