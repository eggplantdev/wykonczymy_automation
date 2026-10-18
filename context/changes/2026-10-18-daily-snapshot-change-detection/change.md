---
change_id: daily-snapshot-change-detection
title: Daily snapshot ignores keys a deploy added with their default (EX-1076 step 1)
status: implementing
created: 2026-10-18
updated: 2026-10-18
archived_at: null
branch: null
worktree: null
---

## Notes

EX-1076 step 1: the nightly daily capture compares payloads through the history reader (snapshotToTree) so a key a deploy added with its default no longer stores a spurious full copy.

Prod measurement 2026-10-18: 268 of 448 non-first `daily` rows (63 of 116 MB) only add keys introduced by a deploy (`ref`, `aiPlannedQty`, `catalogueItemId`, etap `completed`, `aiRecheck`…); `isDeepStrictEqual` on raw payloads counts each as a change.
