# Changelog

All notable changes to kimi-ntfy are documented in this file.

## [0.3.0] - 2026-08-17

### Added
- Initial release of the kimi-ntfy plugin for Kimi Code.
- Notifications on `Stop`, `StopFailure`, `SessionEnd`, and `SubagentStop` (toggle, default off).
- Six slash commands: `/kimi-ntfy:setup`, `/kimi-ntfy:test`, `/kimi-ntfy:status`, `/kimi-ntfy:lang`, `/kimi-ntfy:server`, `/kimi-ntfy:subagents`.
- English (default) and Spanish (`/kimi-ntfy:lang es`) notification strings.
- Self-hosted ntfy server support (`/kimi-ntfy:server <url>`).
- Local validation gauntlet: Biome lint, manifest schema check, Node syntax check, `node:test` suite with mock ntfy server.
- GitHub Actions workflows: `validate.yml` on every push/PR, `release.yml` on signed tags (verifies `git verify-tag`).

[0.3.0]: https://github.com/airvzxf/kimi-ntfy/releases/tag/v0.3.0
