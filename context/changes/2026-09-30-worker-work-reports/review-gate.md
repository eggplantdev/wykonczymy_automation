# Review-gate ledger — worker-work-reports (EX-947) · 2026-09-30

Scope: `6b02742f...HEAD` (5b856f81 → e457b738) plus the uncommitted working tree (edit/undo of an
accepted report, the all-reports list, the katalog swap dialog). `59bc4583` (email doc) sits in the
range but belongs to another change.

Step 0.5 (browser verification pass) skipped — the user stopped Playwright runs this session; the
slice's checks sit in `context/foundation/manual-checks.md` § EX-947.

## Findings

<!-- Fan-out: 10x-impl-review (F1–F10), code-review (CR), tailwind-v4-audit, feature-first-structure,
     module-cohesion-audit, structure-scatter-audit, comment-noise-audit. Most-severe first. -->

- [x] 🟡 WARNING · fixed (owner: b — refuse re-targeting) · impl-review F1 + code-review · `src/lib/actions/worker-report.ts` · a change/untick of an accepted line lands in the report's CURRENT etap; once the recorded etap is deleted or the worker left its split, a later add re-targets the report and the old lines' changes hit the wrong etap — adding the rest while a line stays accepted now requires the recorded etap (still there, worker still in it) as the target, else refused; the review shows the problem and the hook drains/patches per (pozycja, etap)
      test: test-driven-debugging · integration — `accept-worker-report.test.ts` „refuses the rest into another etap while a line sits in a deleted one” + „…after the worker left the etap” (red first); dom — `use-worker-report-acceptance.test.tsx` „writes both etapy of a pozycja the save moved in two”
- [x] 🟡 WARNING · fixed · impl-review F2 + code-review · `src/lib/actions/worker-report.ts` · a stale window's accept of a line already accepted is silently applied as a change into the recorded etap — each line carries `seenQty`, a mismatch (or an extra already accepted) refuses „odśwież je”
      test: TDD · integration — „refuses a stale decision”, etap unchanged
- [x] 🟡 WARNING · fixed · impl-review F3 · `worker-report-review.tsx:69-71`, `worker-reports.ts:315` · rejected reports are acceptable again, unrecorded — it IS the user's ruling this session („Trzeba dodać możliwość zmiany decyzji”): recorded in change.md #26–27, plan (Desired End State, write order, Phase 3), domain notes, registry
      test: no automated test — behaviour already pinned by „accepts a line of a report odrzucone w całości” + the re-pointed extra spec
- [x] 🟡 WARNING · fixed · impl-review F4/F5 · `context/foundation/manual-checks.md` § EX-947 · registry lacked edit/untick, katalog swap into an existing pozycja, decided reports on `/zgloszenia-prac`, and said rejected is read-only — checks added (incl. the lost-etap refusal and the stale-window refusal), reject line rewritten
- [x] 🟡 WARNING · fixed · impl-review F5 · `line-draft.ts`, `catalogue-swap-dialog.tsx`, `kosztorys-worker-share.ts` · unplanned but deliberate: katalog swap adds to an existing matching pozycja; a menu click mints + copies both link kinds — plan § „Additions made during implementation”
- [x] 🔵 OBSERVATION · fixed · impl-review F7 + code-review · `worker-report.ts` · a save with nothing effective still snapshots, bumps the revision, overwrites decided_at/by — refused as stale before any write
      test: TDD · integration — „a no-op save leaves the report as it was”
- [x] 🔵 OBSERVATION · fixed · code-review · `line-draft.ts` `acceptedQtyNote`, `review-lines-table.tsx` · after a restore the untick said „cofasz X” but subtracts nothing — reads „nie ma już czego cofnąć” when the figure is not live
      test: TDD · unit — `line-draft.test.ts`
- [x] 🔵 OBSERVATION · fixed · code-review · `line-draft.ts` `qtyInputText` · rounded to 3 decimals, so 1,2345 was accepted as 1,235 and reopened as „changed” — rounds to the qty scale (6)
      test: TDD · unit — `line-draft.test.ts` precision round-trip
- [x] 🔵 OBSERVATION · fixed · impl-review F8 + code-review · `worker-report.ts` · deltas/sums bound JS float noise — `round6` before binding
      test: TDD · integration — „a changed ilość without float noise” (0,3 → 0,1)
- [x] 🔵 OBSERVATION · fixed · impl-review F10 · `plan.md`, `use-worker-report-acceptance.ts` · plan text and one hook comment lagged the code — write order, Phase 3/4 intents, floating point (`round6`), drain of every (pozycja, etap); hook comment replaced
- [x] 🔵 OBSERVATION · filed · impl-review F9 · `worker-reports.ts:229-250` · `/zgloszenia-prac` lists every report unbounded — owner: max 100 per page + filters, like the other listings — filed EX-955
- [x] fixed · code-review · `worker-report.ts` reject · expired the broad `investments` tag though every report reader is uncached — narrowed to the investment's entity tag, kept only because its expiry re-renders the shell's nav badge (`investmentAction` opts now pass `entityTags` through)
- [x] fixed · code-review · `worker-report.ts` · recorded etap looked up twice — once, reused by the F1 rule
- [x] fixed · code-review · `worker-report.ts` · `sectionById` pre-check duplicated `sectionOwnerAndNextItemOrder`'s owner check — removed
- [x] fixed · code-review · `worker-reports.ts` · `claimReportForAccept` doc credited the wrong serialiser — replaced by `markReportAccepted`, doc names `lockInvestmentGates`
- [x] fixed · module-cohesion · `src/lib/actions/worker-report.ts` (517 LOC) · send vs decide are two reasons to change — split reject/accept into `accept-worker-report.ts` (specs already follow the seam)
- [x] fixed · module-cohesion · `worker-report-review.tsx` · `initialDrafts` + the accept-input builder moved into `line-draft.ts` (`initialDrafts`, `partitionLines`, `buildAccept`) — unit-tested there
- [x] fixed · module-cohesion · `src/lib/db/worker-reports.ts:113-148` · `readReportShare` is the token table, not report statements — `lib/db/worker-report-share.ts`
- [x] fixed · module-cohesion + scatter + feature-first · `lib/db/worker-reports.ts:9-10` vs `worker-report/types.ts:50-52` · twin status/kind unions — db imports the domain ones
- [x] fixed · module-cohesion + feature-first · `worker-report/types.ts:35` · `ReportModeT` is an editor prop contract — colocate with `report-column.tsx`
- [x] fixed · module-cohesion · `stage-progress.ts:5` vs `types.ts:121` · `StageProgressCellT` shape written twice
- [x] fixed · module-cohesion + feature-first · `report-column.tsx:15` · `REPORT_STAGE_ID` exported, no outside consumer
- [x] fixed (owner: „prace”) · module-cohesion + feature-first · `send-bar.tsx:13`, `worker-reports-list.tsx:16`, `worker-report-review.tsx:53` · `POZYCJA_FORMS` in a component file + two hand copies → `counted-nouns.ts`; report screens count „prace”
- [x] fixed · feature-first + scatter · `worker-report/{report-columns.tsx,section-pill.tsx,report-row-class-name.ts}` · only consumer is the review table — move to `editor/dialogs/worker-reports/`
- [x] fixed · feature-first + scatter + impl-review F6 · `dialogs/catalogue/use-catalogue-filters.ts` · read from two directories — promote to `editor/hooks/`
- [x] fixed · feature-first · `lib/actions/{worker-report-share.ts,write-worker-link.ts}` · two halves of one worker-link concern — fold into `kosztorys-worker-share.ts`, helper private
- [x] fixed · feature-first + scatter · `lib/queries/worker-report.ts` · one letter from `worker-reports.ts`, different reader — rename `worker-report-page.ts`
- [x] fixed · scatter + feature-first · `components/work-reports/`, `tables/work-reports.tsx`, `WorkReport*` · „work-report” vs „worker-report” for one concept — rename to worker-report
- [x] dropped · feature-first · `lib/actions/token-action.ts` · rename to `reportTokenAction` — the plan names it `tokenAction`, one consumer, the name costs nothing
- [x] skipped · module-cohesion · `kosztorys-editor-body.tsx` · report-mode layout as a leaf hook — the body was over size before this change; the report extraction is already the plan's deferred item (plan :164)
- [x] fixed · tailwind-v4 · `catalogue-swap-dialog.tsx:60` (+ `select.tsx:91`, `form-date-picker.tsx:49`, `add-items-from-catalogue-dialog.tsx:176`) · `z-[10001]` → `z-10001`, all four spelled alike
- [x] dismissed · tailwind-v4 · `kosztorys-editor-body.tsx:550` · inline `minWidth` is a runtime-computed value
- [x] dismissed · tailwind-v4 · `branded-header.tsx:19` · `grid-cols-[auto_1fr]` has no named utility; repo precedent `info-list.tsx:21`
- [x] fixed · comment-noise · 5 deletes (`extra-work-rows.tsx:21`, `extra-works-dialog-button.tsx:31`, `use-catalogue-filters.ts:10`, `report-column.tsx`, `globals.css:522-523`), 5 trims (`review-lines-table.tsx`, `catalogue-picker-table.tsx:32`, `report-column.tsx` ×2, `report-grid.tsx`), 7 judgment calls, `worker-reports.ts` `(#14)` and „a rejected line” (now final) cut
- [x] dismissed · comment-noise · `kosztorys-actions-context.tsx:85` · one instance is what lets three openers share one open state — a why
- [x] fixed · simplify · `lib/db/row-coerce.ts` · `v == null ? null : String(v)` hand-written in 4 mappers (`worker-reports`, `kosztorys-tree` private `str`, `kosztorys-item-texts`, `get-payout-transactions`) → `textOrNull`
- [x] fixed · simplify · `lib/db/worker-reports.ts` · `listWorkerReports` / `listWorkerReportsForWorker` were one statement twice → one reader, optional `workerId`
- [x] fixed · simplify · `lib/db/worker-reports.ts` · `pendingQtyByItem` built a Map every consumer re-spread into a Record → returns the Record
- [x] fixed · simplify · `lib/db/worker-reports.ts` · `setReportTarget` was a second UPDATE of the row `markReportAccepted` already writes → one statement, target optional
- [x] fixed · simplify · `lib/db/worker-reports.ts` · `clearLineAcceptance` ran once per undone line → `clearLinesAcceptance(ids)`, one `IN (sqlList)` statement
- [x] fixed · simplify · `token-action.ts`, `worker-report-page.ts` · the closed / template / inactive refusal order written twice → `reportShareRefusal`
- [x] fixed · simplify · `worker-report-page.ts`, `worker-kosztorys.ts` · the page re-read the share by token after resolving it, and its three reads ran in sequence → `getWorkerKosztorysByReportShare(share)` + one `Promise.all`
- [x] fixed · simplify · `worker-report/qty-schema.ts`, `types.ts`, both actions · zod schemas and hand-written twins of their types → `schemas.ts`, types via `z.input`
- [x] fixed · simplify · `accept-worker-report.ts`, `worker-report-review.tsx` · „is he in this etap's split” written 3× → `isStageMember` in `worker-view/scope.ts`
- [x] fixed · simplify · `worker-report-review.tsx` · both target refusals typed as literals the server also returns → `ACCEPT_REFUSALS`; the plane-pick condition named once (`needsPlanePick`)
- [x] fixed · simplify · `worker-report-review.tsx` · `rows.find` per line and a separate id Set → one `rowById` Map; pomiar via `rowTotalQtyDone(…, 'client')` instead of a local reduce
- [x] fixed · simplify · `review-lines-table.tsx` · `catalogue.find` in three cells → `catalogueById` built once per table
- [x] fixed · simplify · `dialogs/worker-reports/{report-columns.tsx,section-pill.tsx,report-row-class-name.ts}` · three files and a generic `sectionColumn<RowT>` for one table → inlined into `review-lines-table.tsx`
- [x] fixed · simplify · `line-draft.ts`, `report-grid.tsx` · `String(n).replace('.', ',')` ×3 → `decimalText`; katalog price → `moneyText`
- [x] fixed · simplify · `extra-works-dialog-button.tsx`, `extra-work-rows.tsx` · blank extra literal twice → `blankExtra` in `extra-state.ts`
- [x] fixed · simplify · `unread-badge.tsx` · own-page prefix test re-implemented `isActiveLink` → exported from `use-nav-links.ts`
- [x] fixed · simplify · `kosztorys-worker-share.ts` · four generate/revoke actions differing only in the share builder → `generateWorkerLinkAction(key, kind)` / `revokeWorkerLinkAction(key, kind)` over `WORKER_LINK_SHARES`
- [x] fixed · simplify · `branded-header.tsx` · `children` slot no caller passes — removed
- [x] fixed · simplify · `column-sizing.tsx`, `report-column.tsx` · the five-field pinned-width literal 5× → `pinnedWidth(w)`
- [x] fixed · simplify · `use-kosztorys-editor.ts` · `appendAcceptedItems` was `handleAppendedCatalogueItems`' fold branch verbatim → one function, `newStages` param
- [x] fixed · simplify · `kosztorys_v2/page.tsx` · `parseReportId` re-implemented `parseVersionParam` more loosely → shared `lib/utils/parse-id-param.ts` (both params), `REPORT_PARAM` constant for the three `'zgloszenie'` spellings
- [x] fixed · simplify · `send-bar.tsx` · every qty parsed three times and a dead non-value branch → one pass builds the lines, counts and `hasInvalid` from them
- [x] fixed · simplify · `use-worker-report-acceptance.ts` · inline cell shape → `StageCellT`
- [x] fixed · simplify · `worker-reports-list.tsx` · hand-rolled grouping loop → `Map.groupBy`
- [x] fixed · simplify · `worker-report-form.tsx`, `(share)/zgloszenie-prac/…/page.tsx` · `data` passed beside the `document` it is derived from (the „no price in the payload” reason stopped holding once the grid got the document) → derived in the form; `.worker-report` dropped from both `<main>`s, `globals.css` comment names its one real consumer
- [x] dismissed · simplify · `review-lines-table.tsx` `MeasuredCell` · „share `isOverPlanned` with `QTY_TOLERANCE`” — `hasStagesOverPlanned` uses the same plain `>` with no tolerance; the cell already matches the grid's reading
- [x] dismissed · simplify · `accept-worker-report.ts` · katalog extras skip `placeCatalogueItems`' subcontractor-price warning — the landed row's stawka cells run `checkSubcontractorPrice` themselves, so the verdict still shows in the grid
- [x] dismissed · simplify · `accept-worker-report.ts` reject · „refresh the route instead of an entity tag” — the tag exists only to re-render the nav badge; already narrowed (line above)
- [x] dropped · simplify · `accept-worker-report.ts` `extraAsItem` · full item literal — no shared blank-item builder exists; the 5 such literals repo-wide are a refactor of their own
- [x] dropped · simplify · `accept-worker-report.ts` · tree read twice (snapshot + accept) — `captureAutoSnapshot` reads outside the tx at all 8 call sites; ms cost on a manual click
- [x] dropped · simplify · `worker-reports.ts` `REPORT_COLUMNS` · lateral count / unused join — ms at today's volume; revisit with EX-955 paging
- [x] dropped · simplify · `worker-report-review.tsx` `hintsByLine` · recomputed per draft change — 1–3 ms
- [x] dropped · simplify · `review-lines-table.tsx` `MatchedDescription` · `itemOptions.filter` + `includes` — `matchedItemIds` is 1–3 ids
- [x] dropped · simplify · `unread-badge.tsx` `QUEUE_STREAMS` location, `PENDING_TONE` amber copy — cosmetic
- [x] skipped · simplify (altitude) · `kosztorys-editor-body.tsx` · report surface as one descriptor instead of `report &&` branches — same deferred extraction as the module-cohesion line above
- [x] skipped · simplify (altitude) · `report-column.tsx` `REPORT_STAGE_ID` sentinel → its own seam field on the shared cell hooks — touches every stage cell's edit path; review-worthy on its own
- [x] skipped · simplify (altitude) · `globals.css` report height `!important` → dsg `height: Infinity`; footer portal — both change layout and need a browser pass, which this gate does not run
- [x] skipped · simplify (altitude) · `isDocument` alarm checks → one chokepoint — predates this slice; spans every alarm consumer

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 25 applied, 0 proposed, 3 dismissed, 6 dropped, 4 skipped; each finding folded into ## Findings (tagged simplify).

## Tests & suite

- typecheck (`tsc --noEmit`): clean except the pre-existing `subcontractor-due-by-plane.test.ts:289`
- eslint (touched files): 0 errors
- unit + DOM, touched specs: 11 files / 58 tests green, plus 17 editor specs (itemless-sections, catalogue-problems, document-alarms) green
- DB specs vs 5435, one file at a time: accept-worker-report 24, worker-report 6, worker-share-token 8, token-action 8, db/worker-reports 7, share-token 6, restore-keeps-worker-reports 1, worker-kosztorys-token 7, get-payout-transactions 2, kosztorys-tree.db 5, worker-payout-pairs 9 — all green
- full `pnpm test` / `test:integration` / E2E / build: not run — asked
