---
change_id: kosztorys-commit-on-settle
title: Kosztorys numeric cells commit on settle, not per keystroke (EX-1116)
status: archived
created: 2026-10-20
updated: 2026-10-20
archived_at: 2026-10-20T15:30:48Z
branch: perf/ex-1116-commit-on-settle
worktree: .worktrees/ex-1116-commit-on-settle
---

## Notes

EX-1116 — numeric kosztorys cells commit on Enter/Tab/blur/unmount instead of per keystroke. Spike
dc612530e on perf/ex-1116-commit-on-settle measured 49→31 ms median per keystroke (interleaved A/B,
harness scripts/perf/keystroke-ab.js); owner vibe check passed on preview.

Owner ruling 2026-10-20: live totals while typing are not wanted (toolbar search stays live). Accepted:
row figures and totals update only on Enter/Tab/blur/unmount; closing the tab mid-typing loses the draft;
with a search active the edited row does not drop out mid-typing.

Open gap: hiding the page (`visibilitychange`) settles a numeric draft, but the write still waits in
`useDebouncedSave`'s 500 ms debounce — only unmount flushes. Text cells and stage fields had the same gap
before. Long-text cells still commit per keystroke (unmeasured).
