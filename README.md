# kimi-ntfy

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Version: 0.8.0](https://img.shields.io/badge/version-0.8.0-blue.svg)](kimi.plugin.json)
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
/plugins install git@github.com:airvzxf/kimi-ntfy.git@v0.8.0
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
| `/kimi-ntfy:session <on\|off>` | Toggle `SessionEnd` notifications (default on). |
| `/kimi-ntfy:approval <on\|off>` | Toggle `PermissionRequest` notifications (default on). |
| `/kimi-ntfy:turnend <on\|off>` | Toggle end-of-turn (`Stop`) notifications (default on). Set to `off` in long sub-agent chains so you don't get a push every time a sub-agent (or the main agent) closes a turn — keep `notifySessionEnd` on for the actual end-of-session ping. |
| `/kimi-ntfy:question <on\|off>` | Toggle notifications when the agent asks you a question via `AskUserQuestion` (`[question]`, default on). |
| `/kimi-ntfy:priority <level>` | Override the ntfy priority for every event (see [Priority levels](#priority-levels)). |

## Configuration

The plugin reads and writes `~/.kimi-code/kimi-ntfy-config.json` (mode `0600`):

```json
{
  "topic": "mi-topic-aleatorio-7q2x",
  "server": "https://ntfy.sh",
  "token": "",
  "language": "en",
  "notifySubagent": false,
  "notifySessionEnd": true,
  "notifyApproval": true,
  "notifyQuestion": true,
  "priority": "default"
}
```

| Field | Default | Meaning |
|---|---|---|
| `topic` | (required) | ntfy topic name. Used as the POST path. |
| `server` | `https://ntfy.sh` | Base URL of the ntfy server. |
| `token` | empty | Bearer token sent as `Authorization: Bearer <token>`. |
| `language` | `en` | Notification strings: `en` or `es`. |
| `notifySubagent` | `false` | If `true`, fires on `SubagentStop` too. |
| `notifySessionEnd` | `true` | If `false`, silences notifications on `SessionEnd` (`[closed]`). |
| `notifyApproval` | `true` | If `true`, fires on `PermissionRequest` (`[approval]`). |
| `notifyTurnEnd` | `true` | If `false`, silences every `Stop` push (eliminates the duplicate notification Kimi Code fires when a sub-agent finishes its turn — the `Stop` arrives with the main session's metadata and no `agent_name`, so the previous `notifySubagent`-only filter cannot catch it). Set this to `false` when you run long sub-agent chains. |
| `notifyQuestion` | `true` | If `false`, silences notifications on `TaskStarted` with `kind=question` (`[question]`), which fires when the agent uses `AskUserQuestion` and pauses the turn to wait for input. |
| `priority` | (unset) | Optional ntfy priority override that wins over every per-event default. See [Priority levels](#priority-levels). |

## Priority levels

The plugin defaults to per-event priorities tuned for usefulness without
being noisy:

| Event | Default | Reasoning |
|---|---|---|
| `Stop` | `urgent` (5) | Sound + vibration — turn is done. |
| `StopFailure` | `high` (4) | Long burst + pop-over — read the error. |
| `PermissionRequest` | `urgent` (5) | Long burst + pop-over — Kimi needs approval/input. |
| `SessionEnd` | `low` (2) | Silent — confirmed the session closed. |
| `SubagentStop` | `min` (1) | Silent — only meaningful when `notifySubagent` is on. |
| `TaskStarted` (kind=`question`) | `urgent` (5) | Long burst + pop-over — Kimi paused the turn to ask you something. |

Use `/kimi-ntfy:priority <level>` to override every event with one of the
five ntfy levels (aliases in parentheses):

| Level | Sound | Vibration | Do-Not-Disturb override |
|---|---|---|---|
| `min` (`silent`) | none | none | no |
| `low` | none | none | no |
| `default` (`normal`) | yes | yes | no |
| `high` | long burst | yes | no |
| `urgent` (`max`, `critical`) | yes | long | yes |

Examples:

```
/kimi-ntfy:priority silent       # silence every notification
/kimi-ntfy:priority urgent       # max-out everything (use sparingly)
/kimi-ntfy:priority reset        # back to per-event defaults
```

The override is stored as a string in `kimi-ntfy-config.json`. Pass `/kimi-ntfy:priority reset`
(or delete the `priority` field) to revert to per-event defaults.

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

The plugin declares five lifecycle hooks. Each handler reads `kimi-ntfy-config.json`
and POSTs to the configured topic.

| Event | Title | Tags | Priority | Default |
|---|---|---|---|---|
| `Stop` | `<project> - done` | `white_check_mark, robot` | 5 (urgent) | on (toggle `notifyTurnEnd`) |
| `StopFailure` | `<project> - failed` | `x, warning` | 4 (high) | on |
| `SessionEnd` | `<project> - session closed` | `wave, robot` | 2 (low) | on (toggle `notifySessionEnd`) |
| `SubagentStop` | `<project> - sub-agent <name> done` | `link, robot` | 1 (min) | off (toggle `notifySubagent`) |
| `PermissionRequest` | `<project> - approval` | `hand, warning` | 5 (urgent) | on (toggle `notifyApproval`) |
| `TaskStarted` (kind=`question`) | `<project> - question` | `question, bell` | 5 (urgent) | on (toggle `notifyQuestion`) |

Every notification includes:

- `Actions`: `copy` button to copy the `kimi --session <id>` resume command to clipboard.
- `Markdown`: yes, so the body renders as Markdown in the ntfy app.
- Body: working directory (`📁`), session title (`💬`), assistant response or status (`📢`/`❓`), and resume command (`🔗`).

Sample body for `Stop`:

```text
📁 /home/wolf/projects/app
💬 Fix login page

📢 Todo listo sin errores.

🔗 kimi --session 01HZ...XYZ
```

The handler is fail-open: it always exits `0`, even on ntfy errors. A failure
writes one line to `stderr` and never blocks the agent's turn.

## Diagnostics

Every hook invocation writes a JSONL trail — one self-contained JSON
object per line — to:

```
~/.kimi-code/logs/kimi-ntfy.jsonl
```

The format mirrors `kimi-code.log` in location (Kimi Code's
`data-locations` convention: all logs under `$KIMI_CODE_HOME/logs/`) but
uses JSON Lines so every line is `jq`-, `grep`-, and pipeline-friendly.

```bash
# Tail the most recent decisions.
tail -F ~/.kimi-code/logs/kimi-ntfy.jsonl | jq -c .

# Filter to a single session.
grep "$(jq -r .session_id ~/.kimi-code/sessions/<you>/<sid>/state.json)" \
  ~/.kimi-code/logs/kimi-ntfy.jsonl | jq -c .

# Count how many Stops were silenced by settle-check last week.
jq -c 'select(.event=="settle" and .result==false)' \
  ~/.kimi-code/logs/kimi-ntfy.jsonl | wc -l
```

Event names you'll see in `event`:
`invoke`, `config`, `filter`, `settle`, `notify`, `exit`. The `exit`
event always carries a `path` field with one of `ok`, `settle_silenced`,
`filter_silenced`, `no_config`, `bad_stdin`, `unknown_event`,
`notify_error` — a single grep shows what happened to any given
invocation.

### Channels

INFO events go to `stdout`. ERROR and FATAL events go to `stderr`.
This mirrors the POSIX convention
`<app> 1> <app>.stdout.jsonl 2> <app>.stderr.jsonl`. Both streams are
captured by Kimi Code into per-task `output.log` automatically — no
extra wiring needed.

The persisted file above collects **all** events regardless of level,
for users who don't want to grep through `sessions/<id>/...`.

### Overrides

| `KIMI_NTFY_LOG=…` | Effect |
|---|---|
| unset / empty | write to default path |
| `/some/file.jsonl` | write to that path instead |
| `disable` | skip the file; streams still emit |
| `silent` | suppress everything (useful for `node --test`) |

### Rotation

The persisted file rotates to `<path>.1` once it crosses 10 MB,
overwriting the previous `.1`. One historical file kept. Concurrency
between simultaneous handler invocations is benign: a second handler
sees `EEXIST` on the rename and writes to the freshly recreated active
file — the log keeps working, only the atomic rotation is lost.

### Format reference

```json
{"ts":"2026-08-26T01:23:45.123Z","level":"info","event":"invoke","hook_event":"Stop","sid":"session_…","agent":"main","cwd":"/tmp"}
{"ts":"2026-08-26T01:23:46.012Z","level":"info","event":"settle","sid":"session_…","result":false,"pending_tool_calls":2,"last_finish_reason":"tool_use","attempts":0}
{"ts":"2026-08-26T01:23:48.678Z","level":"info","event":"exit","code":0,"path":"ok"}
```

Reserved fields at the JSON root: `ts`, `level`, `event`. Anything the
handler attaches (`hook_event`, `sid`, `agent`, `cwd`, `pending_tool_calls`,
`reason`, `error_message`, …) sits at the same level.

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
/plugins install git@github.com:airvzxf/kimi-ntfy.git@v0.8.0
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
| `/kimi-ntfy:session <on\|off>` | Activa o desactiva las notificaciones de fin de sesión (`[cerrada]`, default on). |
| `/kimi-ntfy:approval <on\|off>` | Activa o desactiva las notificaciones cuando Kimi requiere aprobación (`[aprobación]`, default on). |
| `/kimi-ntfy:turnend <on\|off>` | Activa o desactiva las notificaciones de fin de turno (`Stop`, default on). Ponlo en `off` cuando uses cadenas largas de sub-agentes para no recibir push cada vez que un sub-agente (o el main) cierre un turno — deja `notifySessionEnd` en `on` para el push real de fin de sesión. |
| `/kimi-ntfy:question <on\|off>` | Activa o desactiva las notificaciones cuando el agente hace una pregunta con `AskUserQuestion` (`[pregunta]`, default on). |
| `/kimi-ntfy:priority <nivel>` | Sobrescribe la prioridad de ntfy para todos los eventos (`min`, `low`, `default`, `high`, `urgent`, o `reset`). |

### Configuración

El plugin lee y escribe `~/.kimi-code/kimi-ntfy-config.json` (permisos `0600`):

```json
{
  "topic": "mi-topic-aleatorio-7q2x",
  "server": "https://ntfy.sh",
  "token": "",
  "language": "es",
  "notifySubagent": false,
  "notifySessionEnd": true,
  "notifyApproval": true,
  "notifyTurnEnd": true,
  "notifyQuestion": true
}
```

| Campo | Default | Significado |
|---|---|---|
| `topic` | (obligatorio) | Nombre del topic en ntfy. Se usa como ruta del POST. |
| `server` | `https://ntfy.sh` | URL base del servidor ntfy. |
| `token` | vacío | Bearer token enviado como `Authorization: Bearer <token>`. |
| `language` | `en` | Cadenas de las notificaciones: `en` o `es`. |
| `notifySubagent` | `false` | Si es `true`, dispara también en `SubagentStop`. |
| `notifySessionEnd` | `true` | Si es `false`, silencia notificaciones en `SessionEnd` (`[cerrada]`). |
| `notifyApproval` | `true` | Si es `true`, dispara en `PermissionRequest` (`[aprobación]`). |
| `notifyTurnEnd` | `true` | Si es `false`, silencia todos los `Stop` (útil en cadenas largas de sub-agentes). |
| `notifyQuestion` | `true` | Si es `false`, silencia notificaciones en `TaskStarted` con `kind=question` (`[pregunta]`, disparado cuando el agente usa `AskUserQuestion`). |
| `priority` | (sin definir) | Sobrescritura opcional de prioridad que prevalece sobre los valores por evento. |

Para cambiar el idioma después de la instalación:

```
/kimi-ntfy:lang es
```

El mensaje de confirmación aparece en el idioma al que acabas de cambiar.
