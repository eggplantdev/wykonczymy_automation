---
change_id: ex-430-harden-bulk-insert-restore
title: Harden bulk-INSERT restore — ORDINALITY id-mapping + owed tests
status: planned
created: 2026-07-18
updated: 2026-07-18
archived_at: null
branch: null
worktree: null
---

## Notes

EX-430. `restoreKosztorys` trades Payload's per-doc machinery for one bulk `INSERT … RETURNING id`
per level (via `insert-kosztorys-tree.ts` + `insert-rows.ts`), a ~12.6s→~216ms win on ~3030 rows.
Scope for this change (decided with owner 2026-07-18):

- **Fix now:** the RETURNING-order reliance. Rewrite the 3 bulk inserts to `INSERT … SELECT
unnest(...) WITH ORDINALITY … RETURNING id, ord` and map old→new ids by `ord`, not array position.
  Kills the silent wrong-parent-remap class permanently.
- **Owed tests:** (1) restore rollback-on-error integration test (impl-review 🟡 debt; also the
  tripwire for a Payload upgrade silently breaking the tx handle in `getDb`); (2) wider-field-coverage
  roundtrip (nulls, every discount/cost-variant/override combo, unicode notes); (3) schema-drift
  guard asserting each INSERT column list matches `information_schema.columns`.
- **Deferred by design (no code):** parameter-limit chunking (~3,855-item ceiling, ~10× headroom;
  sibling EX-432 5000-cap truncation already Done so the ugly interaction is neutralized),
  validation-bypass, hooks-bypass.

Source: S-06 kosztorys-snapshots review-gate ledger. Related: EX-432 (Done).
