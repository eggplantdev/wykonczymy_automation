---
change_id: sheet-write-env-guard
title: Google Sheets writes only from production — localhost was overwriting a live client sheet
status: archived
created: 2026-08-26
updated: 2026-08-27
archived_at: 2026-08-27T10:54:05Z
branch: sheet-write-env-guard
worktree: null
---

## Notes

> **Superseded (2026-08-27, `3b8f3bfd`):** the fix shipped is the two-service-account credential
> gate (AGENTS.md → "Google Sheets: two service accounts";
> `context/reference/outgoing-effects-isolation.md`), not the `VERCEL_ENV` guard in `sheets.ts` nor
> the `db:import` sheet-id wipe first scoped below. A flag is only as strong as the machine that
> computes it, and this machine holds production's secrets.

**Incident (2026-08-26).** The local DB is a restored prod dump, so it carries **production** sheet
ids. `src/hooks/transfers/sync-sheet.ts` (`afterChange`/`afterDelete` on `transactions`) fired
`syncSingleTransferToSheet` from every environment — nothing on the `src/lib/google/*` path checked
the environment. Worse, id sequences drifted after the restore, so a local id landed on a
**different** prod row with the same id; the sheet upsert keys on id, so it did not just append
junk, it **overwrote** other rows.

**Correction after research.** The first suspect (transactions 4536/4537 on investment 42) never
reached that sheet — all three tabs were checked. The leak was confirmed by other rows: 36 foreign
rows on 8 production sheets, with 4507 (localhost) and 4586/4598 (preview) traced to the current
DBs. 36 is a **lower bound**: „Zresetuj wydatki inwestycyjne" wipes a tab and rebuilds it from
whichever DB clicked, so an absent row proves nothing. The real vector is a reset+sync from a
non-production DB, which erases a client's whole tab.

**Left in place on purpose.** Four leaked rows stay on the sheets of investments 19 / 46 / 72 / 77
(ids 3013 / 3007 / 3002 / 3784). All four investments are `completed` and none of those sheets links
the app tabs to the kosztorys, so the client never sees them — deliberately leaving junk, not a
cleanup.

**No reverse refusal (review-gate ruling).** Unlike `blobTokenRefusal`, the env layer does **not**
refuse the Editor credential outside production. Your own Editor account shared only on your own
test sheet (never a client's) is the only way to work on the write path locally; refusing the
credential would close it.
