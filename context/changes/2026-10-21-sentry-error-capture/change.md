---
change_id: sentry-error-capture
title: Sentry error capture — map every prod failure that needs an event or an alert (EX-958)
status: preparing
created: 2026-10-21
updated: 2026-10-21
archived_at: null
branch: staging
worktree: null
---

## Notes

Triggered by the 2026-10-21 mail outage (SMTP 535 after the mailbox password was changed in the hosting
panel, `EMAIL_PASS` not updated) and a worker's login problem that left no server-side trace. Sentry
free Developer plan chosen (5k errors/month, email alerts via Sentry's own infra); the capture map is
the durable part — the vendor can be swapped behind one seam later.
