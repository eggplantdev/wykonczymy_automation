# Review-gate ledger — everything since the EX-1053 gate · 2026-10-14

Scope: `a6432d5fe...HEAD` (`9ca8fadf9`), 68 files under `src/` — EX-1026 (expense duplicate finder,
the only change here with a `plan.md`) plus the unplanned commits that landed beside it: per-table
text size / vertical headers / column dividers, the „Zgłoszenia prac” kosztorys window, nav section
titles, kosztorys percent formatting, the stored „Analiza AI” stage. Step 0.5 skipped — the browser
pass drives Playwright, which runs only on an explicit ask. Other sessions' uncommitted edits in the
tree are out of scope; `/simplify` does not touch them.

## Findings

- [x] 🟡 WARNING · skipped · code-review · `src/components/transfers/duplicate-finder-dialog.tsx` · duplicate dialog and shared `expense-duplicates.tsx` columns are Polish-only — the whole duplicate surface is management-facing and has not opted into EX-996; AGENTS lets an un-opted screen stay Polish, and opting it in is one coherent task, not a review patch
      test: no automated test · — not a defect
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/db/expense-duplicate-candidates.ts:96` · transakcja `date` via `text()` assumed to render a JS `Date` as „Wed Oct 14…” and break the newest-first sort — false: this driver returns `timestamptz` as Postgres text (`2026-10-06 12:00:00+00`, the shape `match.test.ts` already pins), the same format as the zgłoszenie side, so the lexical sort holds; a red-first spec proved it and was removed
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/queries/expense-duplicate-groups.ts` · drift from `plan.md` (`withoutDateRange`, the server-side range check, `select: { type }`) — each is an improvement over the plan, recorded here rather than back-ported into it
- [x] dropped · module-cohesion · `src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx` · 634 lines — one table and its cells, not tangled; a split buys nothing now
- [x] dropped · structure-scatter · `src/components/kosztorys/summary/charts/pie-legend.tsx` · imports `formatPercent` from `lib/kosztorys` — pre-existing, cheap, correct home
- [x] dropped · tailwind-v4-audit · `duplicate-finder-dialog.tsx:91`, `worker-reports-dialog.tsx:38` · `sm:max-h-[94vh] sm:max-w-[96vw]` / `sm:max-h-[95vh]` — viewport fractions have no theme scale; a spacing token for a vh value would pollute every `p-`/`m-` utility
- [x] dismissed · comment-noise · `src/components/tables/data-table/table-text-size.ts:5` · carries the why — kept
- [x] dismissed · simplify (reuse) · `src/components/tables/data-table/data-table.tsx:117` · text size could use `usePersistedEnum` — it is persisted beside visibility and column order through the same `column-prefs-storage` read/write and one effect; moving one of three prefs to a second store splits the module, needs a fallback for tables without `storageKey`, and the JSON-encoded value already saved would read back as invalid
- [x] skipped · simplify (reuse) · `src/components/transfers/duplicate-finder-dialog.tsx:121` · „Nieprawidłowy zakres dat” differs from `filters.invoicesInvalidRange` in the invoice dialog — part of opting the finder into i18n, skipped above with the dialog's other strings
- [x] skipped · simplify (simplification + altitude) · `src/lib/queries/shape-investments.ts:115` · `aiProgress` is now always `aiStage ?? 'none'` — a parallel session is editing the AI-stage files (`ai-progress-badge`, `ai-stage-select`, `investment-ai-stage`) right now; dropping the field collides with its in-flight work, so it belongs to that change
- [x] dismissed · simplify (altitude) · `src/lib/queries/expense-duplicate-groups.ts:31` · resolve the table's `where` in SQL via `buildSqlConditions` instead of a `payload.find` id list — `where-to-sql` handles only a flat `Where` and throws on the table's search `or`; the id lookup is the general path, and ~2.7k ids per statement is far from the parameter cap
- [x] dropped · simplify (efficiency) · `src/lib/db/expense-duplicate-candidates.ts:81` · every candidate builds its `pages` JSON though only group members need it (~530 KB, ~26 ms per pass on the local dump for „Wszystko”) — a manual management-only click at a few thousand receipts; splitting the loader into a pages-free pass + a members' pages query is not worth its risk at this scale
- [x] dropped · simplify (efficiency) · `src/lib/queries/expense-duplicate-groups.ts:56` · the second pass re-reads the probes (each matches itself) — `findDuplicatePairs` dedups them by key; skipping the pass for an unfiltered all-time scope is a special case for the same small cost as above
- [x] dropped · simplify (simplification) · `src/components/tables/data-table/table-header.tsx:73` · vertical / horizontal branches repeat `{label}{description}` — they differ in the description's classes and the vertical box's own comment; folding saves a few lines and costs readability
- [x] dismissed · reuse-scan · `src/lib/expense-duplicates/find-duplicates.ts:27` · `bucketBy` vs `groupInOrder` (`lib/utils/group-in-order.ts:3`) — `Map.groupBy` is the platform form of the same thing; `bucketBy` exists only to drop the null bucket, which `groupInOrder` does not
- [x] dismissed · reuse-scan · `src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx` · „Ukryj zweryfikowane” filter vs `useActiveFilter` (`hooks/use-active-filter.ts:3`) — the hook owns its toggle state, while the review's flag lives in the dialog so it survives the remount after „Przyjmij”

## Simplify pass

Ran /simplify (4 agents) then primitive-reuse-scan — simplify: 8 fixed, 1 dismissed + 1 dismissed (altitude), 2 skipped, 3 dropped; reuse-scan: 1 fixed, 2 dismissed. Every finding folded into ## Findings (tagged simplify / reuse-scan). Catalogue homes from `.reuse-scan.json`.

## Tests & suite

- `tsc --noEmit` — clean (re-run after the last fix)
- `eslint` on the edited files — clean (one pre-existing `react-hooks/incompatible-library` warning on `useReactTable`)
- unit/DOM touched specs — worker-expenses, duplicate-finder-dialog, lib/expense-duplicates, review-lines-table: 12 files / 94 tests green; lib/table + components/tables: 13 files / 90 green
- DB specs (5435) — `expense-duplicate-candidates.db` 8/8, `expense-duplicate-groups.db` 6/6, `worker-expense-drafts.db` 46/46
- full suite — not run; awaiting the user's go
