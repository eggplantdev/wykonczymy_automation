---
change_id: login-trace
title: Trace the whole login path to diagnose a silent reload on a worker's phone
status: preparing
created: 2026-10-22
updated: 2026-10-22
archived_at: null
branch: null
worktree: null
---

## Notes

Diagnostic trace of the whole login path (server + client beacons) to find why a worker's Android
Chrome login silently reloads /zaloguj.

Evidence so far (2026-10-21): Damian Jonski (user 41, EMPLOYEE, active, not locked), new Android phone,
normal Chrome and incognito. Pastes email + password, taps „Zaloguj", the page reloads to an empty
login form — no error, no „Logowanie…". Same credentials work from a desktop. Vercel prod logs for his
attempts (19:04–19:08 UTC) show only `GET /zaloguj`, zero `POST /zaloguj` (the desktop login at
19:01:33 UTC is the evening's only POST).

Confirmed (2026-10-22): the phone runs Chrome 83, below Next 16's Chrome 111 floor; the client never
hydrates. Direction: `method="post"` on the login form + the proxy catches a native POST (no
`next-action` header), logs it and redirects to a „browser not supported" page. Full trace dropped.
Tracked in EX-1123; evidence in `research.md`.
