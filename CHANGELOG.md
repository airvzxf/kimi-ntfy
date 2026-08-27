# Changelog

All notable changes to kimi-ntfy are documented in this file.

## [0.8.1] - 2026-08-27

### Fixed
- Question notifications (`[question]`) now fire for foreground
  `AskUserQuestion` calls. The previous hook (`TaskStarted` with matcher
  `question`) was dead code for the common case — Kimi Code only emits
  `TaskStarted` for background tasks (kinds `agent`, `process`,
  `question`), and the LLM almost never calls `AskUserQuestion` with
  `background: true`. Replaced the hook with `PreToolUse` matcher
  `AskUserQuestion`, which fires every time the agent is about to ask,
  before the turn pauses for input.
- The body for multi-question prompts now includes a `(N questions)`
  suffix when more than one question is asked in a single call.
- Defensive guard inside the handler still drops the notification when
  `payload.tool_name !== 'AskUserQuestion'`, so a future matcher change
  in `kimi.plugin.json` cannot leak other `PreToolUse` events through.
- `scripts/validate-manifest.mjs` allowlist updated from `TaskStarted` to
  `PreToolUse` so `npm run validate` stays green.

### Changed
- Hook event switched from `TaskStarted` (matcher `question`) to
  `PreToolUse` (matcher `AskUserQuestion`). Default `notifyQuestion`
  behaviour is unchanged: still on, still toggleable with
  `/kimi-ntfy:question <on|off>`.

## [0.8.0] - 2026-08-26

### Added
- New hook for `TaskStarted` with matcher `question`. Fires when the agent
  uses `AskUserQuestion` and pauses the turn to wait for input, so the
  user gets a push and can come back to answer.
- New `[question] <project>` notification format. Body mirrors
  `PermissionRequest`:
  ```
  📁 {cwd}
  💬 {session_title}

  ❓ {description}

  🔗 kimi --session {session_id}
  ```
  Tags: `question, bell`. Priority: `5` (urgent) — the user is blocked
  waiting for input.
- New `notifyQuestion` config field (default `true`). When `false`, the
  handler silences every `TaskStarted` (`[question]`) push, parallel to
  `notifyApproval` / `notifySessionEnd`.
- New `/kimi-ntfy:question <on|off>` slash command and CLI subcommand
  `kimi-ntfy-cli question <on|off>` that toggle the flag. Aliases
  `questions`, `asks`, `ask` are accepted.
- Defensive guard: a `TaskStarted` whose `task.kind` is not `question`
  exits with `path: unknown_event` instead of leaking a non-question push
  to ntfy. The matcher in `kimi.plugin.json` already filters at the
  source; the guard catches a future matcher change.

### Changed
- `bin/i18n.mjs` gains `questionTitle` / `questionBody`,
  `tags.question`, `priority.question`, and `questionOn` / `questionOff`
  CLI feedback strings in both English and Spanish.
- `cmdSetup` seeds `notifyQuestion: true` so a fresh install lands with
  the field present.
- Version bumped to `0.8.0` (minor: new feature, default-on but
  backward-compatible — the toggle can silence it; the
  matcher-restricted hook means no existing event delivery changes).

## [0.7.0] - 2026-08-26

### Added
- Diagnostic log surface. Every hook invocation writes a JSONL trail
  (one self-contained JSON object per line) to
  `~/.kimi-code/logs/kimi-ntfy.jsonl`. The file follows Kimi Code's
  `data-locations` convention (all logs under `$KIMI_CODE_HOME/logs/`)
  and is the same convention used by `~/.kimi-code/logs/kimi-code.log`.
  Each line carries `ts` (ISO-8601 with milliseconds + Z), `level`
  (`info` / `error` / `fatal`), `event` (one of `invoke`, `config`,
  `filter`, `settle`, `notify`, `exit`), plus caller fields like
  `hook_event`, `sid`, `agent`, `cwd`, `pending_tool_calls`,
  `last_finish_reason`, `reason`, `status`, `error_message`, and `path`.
  The `exit` event summarises the outcome in its `path` field
  (`ok`, `settle_silenced`, `filter_silenced`, `no_config`,
  `bad_stdin`, `unknown_event`, `notify_error`).

- POSIX-aligned streaming. INFO events are emitted to `process.stdout`
  and ERROR/FATAL to `process.stderr`. Kimi Code already captures
  both into per-task `output.log`, so the streams are observable
  without extra wiring. The shell-redirect pattern
  `<app> 1> <app>.stdout.jsonl 2> <app>.stderr.jsonl` works directly
  against the handler.

- Override knobs. `KIMI_NTFY_LOG=<path>` redirects the persisted
  file (tests + power users), `=disable` writes nothing to disk but
  keeps the streams, `=silent` suppresses everything (used by
  `node --test`). Rotation still at 10 MB → rename `.jsonl` →
  `.jsonl.1`.

- New `/kimi-ntfy:session_title` cap. The session title in the body
  (`💬` line) is capped at 78 code points; titles longer than that are
  truncated to `first 36 ⟶ last 36` (75 chars total). Code points are
  counted, so emoji / surrogate pairs are preserved intact. Inspired
  by the user's preference not to use a Title ID until Kimi Code
  exposes one.

- New `kimi-ntfy-cli version` subcommand (with `-v` and `--version`
  aliases) prints the plugin version out of `package.json`. Useful
  when filing bug reports.

### Changed
- Tail-only reads on `wire.jsonl`. `checkMainAgentIdle` and
  `getLastAssistantText` no longer `readFileSync` the entire wire;
  a new `readTail` helper seeks to the last 16–32 KB. For a 2 MB
  wire the handler now completes verification well under 200 ms
  (perf-guarantee test in the suite).
- `subagentResponse` is truncated identically to `assistantText`
  (`RESPONSE_MAX = 3000` chars, marker `*(Truncated)*`). Previously
  it could exceed ntfy's body limit and trigger a silent 4xx.
- `findSessionDir` is computed once per invocation and reused by
  both `verifySettledStop` and `buildNotification` (saves a
  `readdirSync` + `existsSync` walk per Stop event).
- JSON parse errors from a malformed `kimi-ntfy-config.json` are
  now surfaced as an `event:"config" status:"invalid_parse"` log
  line with the underlying SyntaxError, instead of being silently
  treated as "no config".
- Strict log event types. The internal `formatField` helper that
  silently coerced objects to `'[object Object]'` is gone; the
  switch to `JSON.stringify` makes non-serialisable inputs surface
  as a stderr marker line.

### Removed
- The ASCII `key=value` log format from v0.7.x development. The
  shape `<ts> <LEVEL> <event-padded> <key=value>` is replaced by
  JSONL; consumers should migrate any `grep`-based scripts to
  `jq`.
- Dead variable `topicUrl` in `buildNotification` (was never read).

### Fixed
- Subagent responses over the ntfy body limit (default 4 KB on
  ntfy.sh) are now truncated with a marker instead of producing a
  silent 4xx from the server.
- Disabling all output during test runs is now possible via
  `KIMI_NTFY_LOG=silent`, removing log noise from `node --test`
  output without changing the handler code path.

## [0.6.0] - 2026-08-25

### Added
- New `/kimi-ntfy:turnend <on|off>` slash command and CLI subcommand
  `kimi-ntfy-cli turnend <on|off>` that toggle the `notifyTurnEnd` config
  field. Aliases accepted: `turn-end`, `turns`.
- New `/kimi-ntfy:session <on|off>` slash command and CLI subcommand
  `kimi-ntfy-cli session <on|off>` that toggle `notifySessionEnd`.
- New `/kimi-ntfy:approval <on|off>` slash command and CLI subcommand
  `kimi-ntfy-cli approval <on|off>` that toggle `notifyApproval`.
- Hook support for `PermissionRequest` events (`[approval]` notifications).
- Session settlement and main agent idle detection (`agents/main/wire.jsonl`):
  silences proxy-`Stop` events while subagents or tools are running, and verifies
  turn stability before sending notifications.
- Assistant message extraction: notifications now include the actual model response
  text and details in the message body.
- Action button: native `Actions: copy` button in notifications to copy the resume command
  with a single tap. Removed `Click` header to open ntfy directly instead of launching browser.
- Clean notification body hierarchy with icons: `📁` directory, `💬` session title,
  `📢` assistant text / status, `❓` approval prompt, and `🔗` resume command.
- Updated default priorities: `Stop` (5 - urgent), `PermissionRequest` (5 - urgent).

### Changed
- Version bumped to `0.6.0` (minor: new commands and features, backward-compatible).

## [0.5.0] - 2026-08-25

### Added
- New `notifyTurnEnd` config field (boolean, default `true`). When set to
  `false`, the handler silences every `Stop` event regardless of payload,
  eliminating the duplicate push that Kimi Code fires when a sub-agent
  finishes its turn (the `Stop` arrives with the main session's metadata and
  no `agent_name`, so the previous `notifySubagent`-only filter could not
  catch it).
- README has a new row in the config table documenting `notifyTurnEnd`.

### Changed
- Version bumped to `0.5.0` (minor: new feature, backward-compatible — the
  default `true` preserves the previous behavior).

## [0.4.0] - 2026-08-17

### Added
- New `/kimi-ntfy:priority <level>` slash command and CLI subcommand
  `kimi-ntfy-cli priority <level>` that override the ntfy priority for
  every event.
- Accepted levels match the five ntfy priorities: `min`, `low`, `default`,
  `high`, `urgent`. Aliases `silent` (= min), `normal` (= default),
  `max` and `critical` (= urgent) are also accepted for ergonomics. Input
  is case-insensitive and is stored normalized to the canonical key.
- New `priority` field in the config schema. When set, it overrides the
  per-event default for every notification. Invalid values are silently
  ignored so a typo never blocks a notification (the per-event default
  still applies).
- README has a new [Priority levels] section with the table of ntfy
  priorities, the sound/vibration/Do-Not-Disturb behavior of each, and
  the per-event default priorities used when no override is set.

### Changed
- Version bumped to `0.4.0` (minor: new feature, backward-compatible).
- `bin/i18n.mjs` now also exports `PRIORITY_LEVELS`, `PRIORITY_NAMES`, and
  `resolvePriority(name)` as the single source of truth for the mapping
  between friendly names and ntfy numeric priorities.

## [0.3.1] - 2026-08-17

### Fixed
- Slash commands (`/kimi-ntfy:setup`, `:test`, `:status`, `:lang`,
  `:server`, `:subagents`) resolved to `node /bin/kimi-ntfy-cli.mjs` at
  runtime because the `${KIMI_PLUGIN_ROOT}` placeholder from the v2
  proposal expanded to empty. The Kimi Code docs
  (`/customization/plugins.html`) only document `KIMI_PLUGIN_ROOT` as
  injected for **hook** commands; slash-command bodies are plain prompts
  sent to the agent and have no such injection. Replaced the placeholder
  with the documented managed-install absolute path
  `$KIMI_CODE_HOME/plugins/managed/kimi-ntfy/bin/kimi-ntfy-cli.mjs`,
  falling back to `$HOME/.kimi-code` when the env var is unset.

## [0.3.0] - 2026-08-17

### Added
- Initial release of the kimi-ntfy plugin for Kimi Code.
- Notifications on `Stop`, `StopFailure`, `SessionEnd`, and `SubagentStop` (toggle, default off).
- Six slash commands: `/kimi-ntfy:setup`, `/kimi-ntfy:test`, `/kimi-ntfy:status`, `/kimi-ntfy:lang`, `/kimi-ntfy:server`, `/kimi-ntfy:subagents`.
- English (default) and Spanish (`/kimi-ntfy:lang es`) notification strings.
- Self-hosted ntfy server support (`/kimi-ntfy:server <url>`).
- Local validation gauntlet: Biome lint, manifest schema check, Node syntax check, `node:test` suite with mock ntfy server.
- GitHub Actions workflows: `validate.yml` on every push/PR, `release.yml` on signed tags (verifies `git verify-tag`).

[0.4.0]: https://github.com/airvzxf/kimi-ntfy/releases/tag/v0.4.0
[0.3.1]: https://github.com/airvzxf/kimi-ntfy/releases/tag/v0.3.1
[0.3.0]: https://github.com/airvzxf/kimi-ntfy/releases/tag/v0.3.0
