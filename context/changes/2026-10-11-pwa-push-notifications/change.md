---
change_id: pwa-push-notifications
title: Web Push notifications and an app icon badge for the installed PWA
status: new
created: 2026-10-11
updated: 2026-10-11
archived_at: null
branch: null
worktree: null
---

## Notes

Web Push notifications + app icon badge for the installed PWA

Linear: EX-1040 — scope and constraints live there.

First trigger: a worker accepting a wypłata. A manager books a wypłata, the worker gets a push and
a badge on the app icon, confirms the amount, and only then is the transaction accepted. This needs
a lifecycle status on the wypłata (pending → accepted). Ships together with that worker feature.
