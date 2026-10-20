---
change_id: prepush-overlap
title: Run the pre-push unit, integration and typecheck legs at once
status: archived
created: 2026-10-18
updated: 2026-10-20
archived_at: 2026-10-20T15:30:48Z
branch: staging
worktree: null
---

## Notes

Lever A from the follow-up to unit-suite-speed: the hook runs unit (57 s), integration (38 s, one
DB-bound worker) and parity (6 s) one after another, ~101 s. Overlapped under one lock hold with
the unit leg on 5 workers: ~71 s. Lever B (parity on its own clone) dropped — parity is 5.8 s now
that the template exists. `db:dump` stays out of scope.
