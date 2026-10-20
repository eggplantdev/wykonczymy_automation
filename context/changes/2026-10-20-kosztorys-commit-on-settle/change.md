---
change_id: kosztorys-commit-on-settle
title: Kosztorys numeric cells commit on settle, not per keystroke (EX-1116)
status: implemented
created: 2026-10-20
updated: 2026-10-20
archived_at: null
branch: perf/ex-1116-commit-on-settle
worktree: .worktrees/ex-1116-commit-on-settle
---

## Notes

EX-1116 — numeric kosztorys cells commit on Enter/Tab/blur/unmount instead of per keystroke. Spike
dc612530e on perf/ex-1116-commit-on-settle measured 49→31 ms median per keystroke (interleaved A/B,
harness scripts/perf/keystroke-ab.js); owner vibe check passed on preview.
