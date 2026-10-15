---
change_id: remount-latch-disarm
title: The reseed latch disarms when an interrupted replace's refresh brings back the same tree
status: archived
created: 2026-10-15
updated: 2026-10-15
archived_at: 2026-10-15T11:53:23Z
branch: null
worktree: null
---

## Notes

EX-950. A whole-tree write that fails with `REQUEST_FAILED` arms the remount latch and refreshes. When
the write never committed, the refresh returns the same tree, the latch stays armed, and the next
token-moving write (VAT, coeffs, add/remove row, reorder…) remounts the body — losing sort/filter and
dropping a cell edit still in its 500 ms debounce (`dispose()` clears pending timers).
