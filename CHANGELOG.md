# Changelog

All notable changes to kimi-ntfy are documented in this file.

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
