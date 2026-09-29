---
change_id: cancellation-sum-overcount
title: „Suma wybranych transakcji" overcounts by the amount of every CANCELLATION row
status: archived
created: 2026-07-28
updated: 2026-07-28
archived_at: 2026-07-28T18:03:48Z
branch: staging
worktree: null
---

## Notes

EX-574 (High, project Wykonczymy). `stripCancelledFilters` drops the default
`type: { not_in: ['CANCELLATION'] }` alongside the `cancelled` condition, but the SQL in
`sumFilteredByType` only re-adds `cancelled IS NOT TRUE`. A CANCELLATION row copies the original's
amount verbatim and carries `cancelled = false`, so a cancelled transaction nets to +1× instead of 0.
March 2026: 7 192 866,38 zł displayed vs 4 202 513,34 zł actual (+71%).

Analysis 2026-07-28 confirmed every line reference still matches HEAD, and found two things the
Linear issue does not state:

- The Pulpit's „Ostatnie transakcje" table (`manager-dashboard.tsx:38`) is affected too — same
  filters, no relational scope — so the audience includes MANAGER, not just ADMIN/OWNER.
- Fix option (a) from the issue (filter CANCELLATION out of the `reduce` in
  `transfer-table-server.tsx`) is wrong: it would zero the tile in audit mode
  (`?cancelledTransactionAudit=1`), where the list is exclusively CANCELLATION rows.

**Scope: two defects, one change** (owner, 2026-07-28). Alongside EX-574, the same tile drops the
amount filter's upper bound — `buildTransferFilters` emits `less_than`, which `where-to-sql.ts:82-92`
does not handle and silently ignores. `?amount=500,00` lists 20 rows totalling 10 000 zł under a tile
reading 22 560 189,17 zł. Same file, same tile, same spec; each gets its own red test and commit.

**Dispositions (owner, 2026-07-28):** both defects tracked under EX-574, no second issue. The
`/raporty` E2E is deferred to the `e2e-backlog` label rather than authored. The `showCancelled`/audit
residual mismatch stays unfixed, but the tile gains an on-screen note saying what it counts.

> **Superseded:** `/raporty` is disabled until EX-598 (`src/app/(frontend)/raporty/page.tsx`); the
> Pulpit remains an exposed surface.

Prior research on the transfer-type surface: `context/archive/2026-07-25-transfer-type-spec-table/change.md` (its `research.md` was distilled into that file and deleted 2026-08-08).
Related: EX-573 (transfer-type spec table) — independent, no need to wait for it.

## Kept from `research.md` / `repro.md` (both deleted 2026-08-08)

- **The proof shape, reusable for any "the tile disagrees with the list" bug:** group the months and
  compare `SUM(amount) FILTER (WHERE type <> 'CANCELLATION')` against bare `SUM(amount)`. January and
  February 2026 carry **zero** cancellations and **zero** error — control months are what turn a
  suspicious delta into a proof that the error is _exactly_ the cancellation sum and never anything
  else.
- **Regression surface was none, and that was verified rather than assumed.** Every other consumer
  buckets by `financialBucketOf`, and `CANCELLATION` carries `financialBucket: 'none'`, so it already
  contributed 0 to margin, balance, income, materials, payouts and every category breakdown. Only the raw
  reduce in `transfer-table-server.tsx` read the untyped distribution.
- **Unaffected by design:** `/inwestycje/[id]`, `/kasa/[id]`, `/pracownicy/[id]` — their `Where`
  carries a relational column that survives the strip, and every cancellation row has that column NULL. The
  exposed surfaces were `/raporty` and the Pulpit (`manager-dashboard.tsx`), which is what put the
  defect in front of MANAGER too.
- **A prefix amount search (`?amount=500`) was always correct** — it takes the `like` branch, which the
  translator handles. Only the decimal form (`500,00`) hit the missing `less_than`.
- **The two residual mismatches the fix deliberately does not address:** in `showCancelled` mode the
  tile omits the cancelled originals the list shows, and in audit mode it omits the originals spliced
  in at `transfer-table-server.tsx`. Both come from the hardcoded `cancelled IS NOT TRUE` in SQL, both
  pre-date this change, and the tile's on-screen note is what covers them. Don't mistake either for a
  failed fix.
- The generalised translator trap is in `context/foundation/lessons.md` ("a hand-written `Where` → SQL
  translator fails OPEN").
