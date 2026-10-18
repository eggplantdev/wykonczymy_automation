---
change_id: test-suite-speed
title: Cut test-suite wall-clock time further
status: implemented
created: 2026-10-18
updated: 2026-10-18
branch: staging
worktree: null
---

## Notes

Follows EX-1093 (DB integration 250 s → 70 s by moving 115 specs to db-shared). Where does the
remaining time go across `pnpm test`, `test:integration`, the pre-push legs and E2E, and which
levers cut it further?
