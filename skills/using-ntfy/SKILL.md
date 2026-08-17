---
name: using-ntfy
description: How to configure kimi-ntfy, install the ntfy mobile app, pick a topic, and optionally point the plugin at a self-hosted ntfy server.
---

# ntfy.sh and kimi-ntfy

ntfy.sh is a simple pub/sub HTTP service. You POST a message to a URL like
`https://ntfy.sh/<topic>` and every device subscribed to that topic receives a
push notification. No account is required for the public server.

## Why the topic name matters

The topic is the password when you are not using authentication. Pick a long
random suffix that no one can guess:

```
mi-topic-aleatorio-7q2x
my-random-topic-x9p2k4
```

Anyone who knows the topic name can read its messages, so treat it like an
API key.

## Install the mobile app

- iOS: App Store, search "ntfy".
- Android: Google Play or F-Droid, search "ntfy" (F-Droid build is unsigned and
  needs the F-Droid client).
- Desktop: web UI at `https://ntfy.sh/<topic>` works in any browser.

Open the app, tap "+", and subscribe to your topic. You will get a push for
every message posted to it.

## The six slash commands

| Command | What it writes |
|---------|----------------|
| `/kimi-ntfy:setup <topic> [server] [token]` | `topic` (required), `server` (defaults to `https://ntfy.sh`), `token` (optional Bearer token) |
| `/kimi-ntfy:test` | Sends a test message to the configured topic; HTTP 200 means everything works |
| `/kimi-ntfy:status` | Prints the current config and the topic URL |
| `/kimi-ntfy:lang <en\|es>` | Notification copy and CLI messages language; default `en` |
| `/kimi-ntfy:server <url> [token]` | Change the ntfy server without rewriting the topic; pass an empty token string to clear it |
| `/kimi-ntfy:subagents <on\|off>` | Toggle push notifications for `SubagentStop` events; default `off` |

Config lives at `~/.kimi-code/kimi-ntfy-config.json` (or `$KIMI_CODE_HOME`).
The CLI sets file mode `0600`.

## Self-hosted ntfy (Docker)

Run the official image on a VPS:

```bash
docker run -d \
  --name ntfy \
  --restart unless-stopped \
  -p 2586:80 \
  -v /var/cache/ntfy:/var/cache/ntfy \
  binwiederhier/ntfy serve
```

Put nginx or Caddy in front for TLS, then point the plugin at it:

```
/kimi-ntfy:server https://ntfy.tu-dominio.com
/kimi-ntfy:setup mi-topic tk_xxx
```

See `https://docs.ntfy.sh/install/` for `server.yml` auth and base URL setup.

## Live demo topic

A public topic is kept open for development:

```
https://ntfy.sh/airvzxf-kimiCode
```

Subscribe to it from your phone to watch pushes land during testing.