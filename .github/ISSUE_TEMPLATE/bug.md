---
name: Bug report
about: Report something that does not work as expected in kimi-ntfy
title: "[bug] "
labels: bug
assignees: ''
---

## Description

A clear and concise description of what the bug is.

## Steps to reproduce

1. Run `/kimi-ntfy:setup ...`
2. Run `/kimi-ntfy:test`
3. See error / no notification / wrong notification

## Expected behavior

What you expected to happen.

## Actual behavior

What actually happened. Include any error output from the terminal or the ntfy app.

## ntfy server

- Public (`https://ntfy.sh`) or self-hosted?
- If self-hosted, which URL and which image (e.g. `binwiederhier/ntfy`)?
- Are you using a topic token, or is the topic open?

## Plugin version

- `kimi-ntfy` version (from `kimi.plugin.json`): vX.Y.Z
- Commit SHA if you installed from a specific commit

## Kimi Code version

- Output of `kimi --version` (or equivalent).

## OS

- OS and version (e.g. Arch Linux rolling, macOS 14, Ubuntu 24.04).
- Node.js version (`node --version`).

## Additional context

Anything else that might help: logs, screenshots of the notification, network captures, etc.
