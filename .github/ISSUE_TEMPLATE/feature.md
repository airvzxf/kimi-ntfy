---
name: Feature request
about: Suggest an idea or improvement for kimi-ntfy
title: "[feature] "
labels: enhancement
assignees: ''
---

## Problem

What problem are you trying to solve? A sentence or two on the pain point, not the
solution. Example: "When a long session ends I want to know which file the agent
last edited without opening the notification."

## Proposed solution

What you would like kimi-ntfy to do. Reference the existing config fields
(`topic`, `server`, `token`, `language`, `notifySubagent`) or hooks (`Stop`,
`StopFailure`, `SessionEnd`, `SubagentStop`) when relevant.

## Alternatives

Other ways you considered, and why you prefer the proposed one.

## Additional context

- ntfy server you use (public or self-hosted).
- Plugin version.
- Whether the change can be done entirely in `bin/i18n.mjs`, `bin/notify.mjs`,
  or `bin/kimi-ntfy-cli.mjs`, or whether it needs a new hook event.
- Anything else (screenshots, mockups, links).
