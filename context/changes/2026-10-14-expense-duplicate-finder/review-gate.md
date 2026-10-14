# Review-gate ledger — everything since the EX-1053 gate · 2026-10-14

Scope: `a6432d5fe...HEAD` (`9ca8fadf9`), 68 files under `src/` — EX-1026 (expense duplicate finder,
the only change here with a `plan.md`) plus the unplanned commits that landed beside it: per-table
text size / vertical headers / column dividers, the „Zgłoszenia prac” kosztorys window, nav section
titles, kosztorys percent formatting, the stored „Analiza AI” stage. Step 0.5 skipped — the browser
pass drives Playwright, which runs only on an explicit ask. Other sessions' uncommitted edits in the
tree are out of scope; `/simplify` does not touch them.

## Findings

- [x] fixed · simplify (altitude) · `src/components/worker-expenses/pending-expense-drafts.tsx:68` · the finder's `?zgloszenie=` link opened the dialog — which fires `findExpenseDraftDuplicates` synchronously for a read zgłoszenie — and called `router.replace` in the same tick; a navigation discards every pending server action, so „Możliwe duplikaty” would hang on checking (the 350746cc9 class) — the parameter now goes through `history.replaceState` when the dialog closes (dismiss, save or reject) and immediately only on the „already decided” path, where nothing is in flight; new `lib/utils/strip-search-param.ts`
      test: test-driven-debugging · unit (DOM) — `pending-expense-drafts.test.tsx` red first (`router.replace` called on arrival), now asserts the URL keeps the param while open and loses only it on Escape; the discard itself needs the real router — manual check § EX-1026 updated
- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/lib/db/expense-duplicate-candidates.ts:17` · probe filter repeated every amount / number once per probe — an all-time run binds one parameter per probe toward Postgres's 65 535 cap, and probes were fed to the matcher twice — `matchFilterOf` dedups the values (and replaces the copy-pasted filter in both queries); `findDuplicatePairs` dedups documents by key on entry
      test: no automated test · integration — the cap is not reachable with fixtures; the two DB specs guard the unchanged output
- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/components/worker-expenses/pending-expense-drafts.tsx:72` · „To zgłoszenie jest już rozpatrzone” hard-coded on a screen already opted into i18n — now `translate(locale, 'notices', 'draftAlreadyDecided')`, the key every language already has
      test: no automated test · unit — the existing DOM spec asserts the (now dictionary) wording
- [x] 🟡 WARNING · skipped · code-review · `src/components/transfers/duplicate-finder-dialog.tsx` · duplicate dialog and shared `expense-duplicates.tsx` columns are Polish-only — the whole duplicate surface is management-facing and has not opted into EX-996; AGENTS lets an un-opted screen stay Polish, and opting it in is one coherent task, not a review patch
      test: no automated test · — not a defect
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:266` · after „Przyjmij” the review re-enabled before the reread report arrived (a second click resends the same decisions), and a failed reread left the pre-save review on screen — the button stays disabled until the remount; a failed reread drops back to the list
      test: no automated test · unit (DOM) — the window is a sub-second reread and a DOM harness for the review (editor context + report fixture) does not exist yet; manual check added (§ review-gate-fixes-14)
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/db/expense-duplicate-candidates.ts:96` · transakcja `date` via `text()` assumed to render a JS `Date` as „Wed Oct 14…” and break the newest-first sort — false: this driver returns `timestamptz` as Postgres text (`2026-10-06 12:00:00+00`, the shape `match.test.ts` already pins), the same format as the zgłoszenie side, so the lexical sort holds; a red-first spec proved it and was removed
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/db/worker-expense-drafts.ts:484` · two `DECIDED_READ_ROWS` definitions (per-draft and all-drafts) — one `decidedReadRows(draftId)` in `worker-expense-drafts.ts`, the candidate loader filters with it per row
      test: no automated test · integration — behaviour-preserving; `worker-expense-drafts.db.test.ts` (46) and both duplicate DB specs green
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/queries/expense-duplicate-groups.ts` · drift from `plan.md` (`withoutDateRange`, the server-side range check, `select: { type }`) — each is an improvement over the plan, recorded here rather than back-ported into it
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/foundation/manual-checks.md` · no check that the finder stays off the investment and kasa pages — added to § EX-1026
- [x] fixed · feature-first-structure · `src/components/filters/column-toggle.tsx` · `filters/` and `tables/data-table/` imported each other — moved to `src/components/tables/data-table/column-toggle.tsx`, 11 imports updated
- [x] dropped · module-cohesion · `src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx` · 634 lines — one table and its cells, not tangled; a split buys nothing now
- [x] fixed · structure-scatter · `src/lib/expense-duplicates/constants.ts` · `RECEIPT_TYPES` spelled twice (SQL literal + array) — one constant, the loader uses `inList`
- [x] fixed · structure-scatter · `src/lib/expense-duplicates/types.ts` · `CandidateT` / `DuplicateMatchT` / `DuplicateGroupsT` lived in the db module and two queries — moved to `types.ts`; `groupDuplicates` returns `DuplicateGroupsT<D>`; the matcher's own types stay in `match.ts`
- [x] dropped · structure-scatter · `src/components/kosztorys/summary/charts/pie-legend.tsx` · imports `formatPercent` from `lib/kosztorys` — pre-existing, cheap, correct home
- [x] fixed · structure-scatter · `src/lib/utils/date-range.ts` · „no window” tested inline in the dialog and the query — `isAllTime(range)`
- [x] dropped · tailwind-v4-audit · `duplicate-finder-dialog.tsx:91`, `worker-reports-dialog.tsx:38` · `sm:max-h-[94vh] sm:max-w-[96vw]` / `sm:max-h-[95vh]` — viewport fractions have no theme scale; a spacing token for a vh value would pollute every `p-`/`m-` utility
- [x] fixed · comment-noise · `src/lib/queries/transfer-filters.ts:279` · doc comment restated the name — deleted
- [x] fixed · comment-noise · `src/components/tables/data-table/data-table.tsx:82` · restated `defaultTextSize` — deleted
- [x] fixed · comment-noise · `src/__tests__/lib/kosztorys/format.test.ts:7` · `// pl-PL comma` restated the assertion — deleted
- [x] fixed · comment-noise · `src/lib/db/expense-duplicate-candidates.ts:202` · „the 1-based ordinality it always had” — vanished-state wording; removed
- [x] dismissed · comment-noise · `src/components/tables/data-table/table-text-size.ts:5` · carries the why — kept
- [x] fixed · simplify (reuse) · `src/app/(frontend)/zgloszenia-wydatkow/page.tsx:39` · hand-rolled `Number` + `isInteger && > 0` id parse — `parseIdParam` (`lib/utils/parse-id-param.ts`), which also caps int4
- [x] fixed · simplify (reuse) · `src/components/worker-expenses/pending-expense-drafts.tsx:74` · URLSearchParams delete / toString / `?` join by hand — `buildUrlWithParams` (now inside `stripSearchParam`)
- [x] fixed · simplify (simplification) · `src/lib/constants/worker-expense-drafts.ts` · `'zgloszenie'` literal in three files (page, queue, `documentHref`) — `OPEN_DRAFT_PARAM`, beside the drafts constants, as `REPORT_PARAM` sits beside `reportHref`
- [x] fixed · simplify (reuse) · `src/lib/expense-duplicates/find-duplicates.ts:27` · `bucketBy` re-implemented `Map.groupBy` — now `Map.groupBy` + `delete(null)`
- [x] fixed · simplify (simplification) · `src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:519` · `stageQtySumColumn` `meta.label` equal to its string `header` — deleted; `columnLabel` falls back to the header
- [x] fixed · simplify (efficiency) · `src/lib/queries/expense-duplicate-groups.ts:31` · `loadDraftCandidates` waited on the unrelated `payload.find` id lookup — both in one `Promise.all`
- [x] dismissed · simplify (reuse) · `src/components/tables/data-table/data-table.tsx:117` · text size could use `usePersistedEnum` — it is persisted beside visibility and column order through the same `column-prefs-storage` read/write and one effect; moving one of three prefs to a second store splits the module, needs a fallback for tables without `storageKey`, and the JSON-encoded value already saved would read back as invalid
- [x] skipped · simplify (reuse) · `src/components/transfers/duplicate-finder-dialog.tsx:121` · „Nieprawidłowy zakres dat” differs from `filters.invoicesInvalidRange` in the invoice dialog — part of opting the finder into i18n, skipped above with the dialog's other strings
- [x] skipped · simplify (simplification + altitude) · `src/lib/queries/shape-investments.ts:115` · `aiProgress` is now always `aiStage ?? 'none'` — a parallel session is editing the AI-stage files (`ai-progress-badge`, `ai-stage-select`, `investment-ai-stage`) right now; dropping the field collides with its in-flight work, so it belongs to that change
- [x] dismissed · simplify (altitude) · `src/lib/queries/expense-duplicate-groups.ts:31` · resolve the table's `where` in SQL via `buildSqlConditions` instead of a `payload.find` id list — `where-to-sql` handles only a flat `Where` and throws on the table's search `or`; the id lookup is the general path, and ~2.7k ids per statement is far from the parameter cap
- [x] fixed · simplify (altitude) · `src/components/tables/data-table/data-table.tsx:84` · `hasColumnDividers` — a public prop on the shared table (~15 consumers) used by one; the descendant selectors now ride on `review-lines-table`'s `className`, which lands on the same outer wrapper
- [x] dropped · simplify (efficiency) · `src/lib/db/expense-duplicate-candidates.ts:81` · every candidate builds its `pages` JSON though only group members need it (~530 KB, ~26 ms per pass on the local dump for „Wszystko”) — a manual management-only click at a few thousand receipts; splitting the loader into a pages-free pass + a members' pages query is not worth its risk at this scale
- [x] dropped · simplify (efficiency) · `src/lib/queries/expense-duplicate-groups.ts:56` · the second pass re-reads the probes (each matches itself) — `findDuplicatePairs` dedups them by key; skipping the pass for an unfiltered all-time scope is a special case for the same small cost as above
- [x] dropped · simplify (simplification) · `src/components/tables/data-table/table-header.tsx:73` · vertical / horizontal branches repeat `{label}{description}` — they differ in the description's classes and the vertical box's own comment; folding saves a few lines and costs readability
- [x] fixed · reuse-scan · `src/lib/table/column-prefs-storage.ts:57` · `readTextSize` copied `readOrder`'s window-guard / try / `getItem` / `JSON.parse` shell — one private `readStored(key): unknown` now serves all three readers; `readTextSize` returns `unknown`, which `isTableTextSize` already takes, and `readOrder` refuses a non-object instead of letting a stored number through `dropNonFiniteRanks` untouched — in-diff copy of `column-prefs-storage.ts:41`
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
