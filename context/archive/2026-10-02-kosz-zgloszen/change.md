---
change_id: kosz-zgloszen
title: Kosz — bulk-trash leads, restore, and erase instead of delete
status: archived
created: 2026-10-02
updated: 2026-10-02
archived_at: 2026-10-02T06:30:36Z
branch: kosz-zgloszen
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/kosz-zgloszen
---

## Notes

EX-970: trash leads (bulk Do kosza on /zgloszenia for A/O/M), /kosz section with restore + Usuń na zawsze (typed name), forever/purge = erase contents with erasedAt flag, keep (source, externalId) so the FB reconcile cron doesn't resurrect; lead deletion must never touch the investment or its files.
