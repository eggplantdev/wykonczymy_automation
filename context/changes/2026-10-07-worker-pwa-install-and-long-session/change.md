---
change_id: worker-pwa-install-and-long-session
title: Installable app icon for workers and a session that survives monthly use
status: implementing
created: 2026-10-07
updated: 2026-10-07
archived_at: null
branch: worker-pwa-install-and-long-session
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/worker-pwa-install-and-long-session
---

## Notes

— PWA install (Android beforeinstallprompt button + iOS picture guide, manifest + icons from public/wykonczymy-app-icon.png), 90-day token with sliding refresh on app open (Payload /api/users/refresh-token), cached sid session-existence check in getCurrentUserJwt so deactivation/trash revokes immediately. Workers open the app ~every 2-4 weeks.
