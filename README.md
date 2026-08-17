# kimi-ntfy

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Version: 0.3.0](https://img.shields.io/badge/version-0.3.0-blue.svg)](kimi.plugin.json)
[![CI](https://github.com/airvzxf/kimi-ntfy/actions/workflows/validate.yml/badge.svg)](https://github.com/airvzxf/kimi-ntfy/actions/workflows/validate.yml)

Kimi Code plugin that pushes a notification to [ntfy.sh](https://ntfy.sh) when the
agent finishes a turn, fails a turn, closes a session, or finishes a sub-agent
(toggle). Supports public ntfy.sh and self-hosted servers. English by default,
Spanish optional.

## Live demo

> **Open demo topic:** [`https://ntfy.sh/airvzxf-kimiCode`](https://ntfy.sh/airvzxf-kimiCode)
>
> This topic is open and subscribed by the maintainer for live demos during
> development. Subscribe in the ntfy app (or open the URL in a browser) to see
> the plugin working in real time.
>
> **Do not post sensitive data here.** Anything you write is visible to anyone
> subscribed to the topic. The topic suffix *is* the password when there is no
> token, so the demo topic is intentionally public and disposable.

## Install

```
/plugins install git@github.com:airvzxf/kimi-ntfy.git@v0.3.0
/reload
/kimi-ntfy:setup mi-topic-aleatorio-7q2x
/kimi-ntfy:test
```

The topic suffix is your only authentication if you do not configure a token.
Pick a long, random string you have never used anywhere else. The CLI enforces
the ntfy rules: letters, digits, `-` and `_`, max 64 characters.

## Slash commands

| Command | Description |
|---|---|
| `/kimi-ntfy:setup <topic> [server] [token]` | Configure topic, server, and optional token. |
| `/kimi-ntfy:test` | Send a test notification to the configured topic. |
| `/kimi-ntfy:status` | Show the current config and topic URL. |
| `/kimi-ntfy:lang <en\|es>` | Switch notification strings between English and Spanish. |
| `/kimi-ntfy:server <url> [token]` | Point the plugin at a different ntfy server. |
| `/kimi-ntfy:subagents <on\|off>` | Toggle `SubagentStop` notifications (default off). |

## Configuration

The plugin reads and writes `~/.kimi-code/kimi-ntfy-config.json` (mode `0600`):

```json
{
  "topic": "mi-topic-aleatorio-7q2x",
  "server": "https://ntfy.sh",
  "token": "",
  "language": "en",
  "notifySubagent": false
}
```

| Field | Default | Meaning |
|---|---|---|
| `topic` | (required) | ntfy topic name. Used as the POST path and the `Click` URL. |
| `server` | `https://ntfy.sh` | Base URL of the ntfy server. |
| `token` | empty | Bearer token sent as `Authorization: Bearer <token>`. |
| `language` | `en` | Notification strings: `en` or `es`. |
| `notifySubagent` | `false` | If `true`, fires on `SubagentStop` too. |

## Self-host

The fastest way to run ntfy yourself is the official Docker image:

```bash
docker run -d \
  --name ntfy \
  --restart unless-stopped \
  -p 2586:80 \
  -v /var/cache/ntfy:/var/cache/ntfy \
  -e TZ=UTC \
  binwiederhier/ntfy serve
```

Put it behind a reverse proxy with TLS (Caddy or nginx + certbot) before you
add a token, and then point the plugin at it:

```
/kimi-ntfy:server https://ntfy.tu-dominio.com
/kimi-ntfy:setup mi-topic tk_xxx
```

The `server` command only updates the URL and preserves `topic`, `token`,
`language`, and `notifySubagent`. Use `setup` with three arguments to rewrite
the whole config in one pass.

## Events

The plugin declares four hooks. Each handler reads `kimi-ntfy-config.json` and
POSTs to the configured topic.

| Event | Title | Tags | Priority | Default |
|---|---|---|---|---|
| `Stop` | `<project> - done` | `white_check_mark, robot` | 3 (default) | on |
| `StopFailure` | `<project> - failed` | `x, warning` | 4 (high) | on |
| `SessionEnd` | `<project> - session closed` | `wave, robot` | 2 (low) | on |
| `SubagentStop` | `<project> - sub-agent <name> done` | `link, robot` | 1 (min) | off |

Every notification includes:

- `Click`: the topic URL on the configured server.
- `Markdown`: yes, so the body renders as Markdown in the ntfy app.
- Body: the working directory, the session title, and a one-line resume
  command (`kimi --session <id>`).

Sample body for `Stop`:

```text
Kimi finished its turn in `/home/wolf/proj`.
Session: Fix login page
To resume: `kimi --session 01HZ...XYZ`
```

The handler is fail-open: it always exits `0`, even on ntfy errors. A failure
writes one line to `stderr` and never blocks the agent's turn.

## Development

```bash
# Install dependencies (Biome only; the plugin itself is zero-dep Node 20+).
npm install

# Run the full validation gauntlet: lint + manifest/syntax check + tests.
npm run validate

# Auto-format with Biome.
npm run format

# Run the test suite (node:test).
npm test
```

The release flow requires a GPG-signed tag:

```bash
git tag -s v0.3.0 -m 'kimi-ntfy v0.3.0'
git push origin v0.3.0
```

The maintainer's signing key fingerprint is `414687A3CD7E65B9`. The
`release.yml` workflow runs `git verify-tag` and refuses to publish a tarball
if the tag is not signed by a key trusted by the runner.

## Security

- The topic name is your only credential when you do not set a `token`. Pick
  something you have never used and that nobody can guess: a long random
  suffix (e.g. `7q2x-9k4m-3j7f`) is fine. The CLI enforces the ntfy rules
  (`[-_A-Za-z0-9]+`, max 64 chars), but it cannot enforce uniqueness.
- The config file is written with mode `0600`. The directory
  `~/.kimi-code/` is created with default permissions if it does not exist.
- Tokens are sent as `Authorization: Bearer <token>`. Use HTTPS for the
  server URL; the CLI rejects anything that is not `http://` or `https://`.
- Do not reuse the demo topic (`airvzxf-kimiCode`) for anything private; it is
  intentionally public.

## License

[AGPL-3.0](LICENSE). Copyright (c) Israel Roldan.

---

## Español

Plugin de Kimi Code que envía una notificación a [ntfy.sh](https://ntfy.sh)
cuando el agente termina un turno, falla un turno, cierra la sesión o termina
un sub-agente (toggle). Soporta ntfy.sh público y servidores propios. Inglés
por defecto, español opcional.

### Instalación

```
/plugins install git@github.com:airvzxf/kimi-ntfy.git@v0.3.0
/reload
/kimi-ntfy:setup mi-topic-aleatorio-7q2x
/kimi-ntfy:test
```

El sufijo del topic es tu única autenticación si no configuras un token.
Elige una cadena larga y aleatoria que no hayas usado nunca. El CLI valida
las reglas de ntfy: letras, números, `-` y `_`, máximo 64 caracteres.

### Comandos slash

| Comando | Descripción |
|---|---|
| `/kimi-ntfy:setup <topic> [server] [token]` | Configura topic, servidor y token opcional. |
| `/kimi-ntfy:test` | Envía una notificación de prueba al topic configurado. |
| `/kimi-ntfy:status` | Muestra la configuración actual y la URL del topic. |
| `/kimi-ntfy:lang <en\|es>` | Cambia el idioma de las notificaciones. |
| `/kimi-ntfy:server <url> [token]` | Apunta el plugin a otro servidor ntfy. |
| `/kimi-ntfy:subagents <on\|off>` | Activa o desactiva las notificaciones de sub-agentes (default off). |

### Configuración

El plugin lee y escribe `~/.kimi-code/kimi-ntfy-config.json` (permisos `0600`):

```json
{
  "topic": "mi-topic-aleatorio-7q2x",
  "server": "https://ntfy.sh",
  "token": "",
  "language": "es",
  "notifySubagent": false
}
```

| Campo | Default | Significado |
|---|---|---|
| `topic` | (obligatorio) | Nombre del topic en ntfy. Se usa como ruta del POST y como `Click`. |
| `server` | `https://ntfy.sh` | URL base del servidor ntfy. |
| `token` | vacío | Bearer token enviado como `Authorization: Bearer <token>`. |
| `language` | `en` | Cadenas de las notificaciones: `en` o `es`. |
| `notifySubagent` | `false` | Si es `true`, dispara también en `SubagentStop`. |

Para cambiar el idioma después de la instalación:

```
/kimi-ntfy:lang es
```

El mensaje de confirmación aparece en el idioma al que acabas de cambiar.
