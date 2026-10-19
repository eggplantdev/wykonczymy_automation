---
change_id: unit-suite-speed
title: Cut the pre-push unit leg and overlap typecheck with integration
status: archived
created: 2026-10-18
updated: 2026-10-18
archived_at: 2026-10-18T20:01:38Z
branch: staging
worktree: null
---

## Notes

Cut the pre-push unit leg (node + dom vitest) and overlap typecheck. Scope = levers 10 (split node and dom into isolated + shared projects; afterEach(cleanup) in setup/dom.ts), 11 (prebundle date-fns + react-day-picker on dom via deps.optimizer.client) and 6 (run typecheck alongside test:integration in .husky/pre-push) from context/changes/2026-10-18-test-suite-speed/research.md. Out of scope: lever 5 (db:dump — blocked until the backup Action is fixed) and the E2E levers. Follows test-suite-speed (integration 70 s → 35.6 s).

## Outcome

`pnpm test` 175 s / 725.8 user CPU-s → 45–56 s / ~218 CPU-s (two runs on a loaded machine; CPU-s is the
steadier figure). Split: `node-shared` 357 / `node` 62, `dom-shared` 140 / `dom` 22 files; the shared
projects passed twice under `--sequence.shuffle`. Phase 5 (typecheck overlap) was superseded by
prepush-overlap.
