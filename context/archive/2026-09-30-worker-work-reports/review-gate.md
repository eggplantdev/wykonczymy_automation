# Review-gate ledger — worker-work-reports (EX-947) · 2026-09-30

Scope: `6b02742f...HEAD` (5b856f81 → e457b738) plus the uncommitted working tree (edit/undo of an
accepted report, the all-reports list, the katalog swap dialog). `59bc4583` (email doc) sits in the
range but belongs to another change.

Step 0.5 (browser verification pass) skipped — the user stopped Playwright runs this session; the
slice's checks sit in `context/foundation/manual-checks.md` § EX-947.

## Findings

<!-- Fan-out: 10x-impl-review (F1–F10), code-review (CR), tailwind-v4-audit, feature-first-structure,
     module-cohesion-audit, structure-scatter-audit, comment-noise-audit. Most-severe first. -->

- [x] 🔵 OBSERVATION · filed · impl-review F9 · `worker-reports.ts:229-250` · `/zgloszenia-prac` lists every report unbounded — owner: max 100 per page + filters, like the other listings — filed EX-955
- [x] dropped · feature-first · `lib/actions/token-action.ts` · rename to `reportTokenAction` — the plan names it `tokenAction`, one consumer, the name costs nothing
- [x] skipped · module-cohesion · `kosztorys-editor-body.tsx` · report-mode layout as a leaf hook — the body was over size before this change; the report extraction is already the plan's deferred item (plan :164)
- [x] dismissed · tailwind-v4 · `kosztorys-editor-body.tsx:550` · inline `minWidth` is a runtime-computed value
- [x] dismissed · tailwind-v4 · `branded-header.tsx:19` · `grid-cols-[auto_1fr]` has no named utility; repo precedent `info-list.tsx:21`
- [x] dismissed · comment-noise · `kosztorys-actions-context.tsx:85` · one instance is what lets three openers share one open state — a why
- [x] dismissed · simplify · `review-lines-table.tsx` `MeasuredCell` · „share `isOverPlanned` with `QTY_TOLERANCE`” — `hasStagesOverPlanned` uses the same plain `>` with no tolerance; the cell already matches the grid's reading
- [x] dismissed · simplify · `accept-worker-report.ts` · katalog extras skip `placeCatalogueItems`' subcontractor-price warning — the landed row's stawka cells run `checkSubcontractorPrice` themselves, so the verdict still shows in the grid
- [x] dismissed · simplify · `accept-worker-report.ts` reject · „refresh the route instead of an entity tag” — the tag exists only to re-render the nav badge; already narrowed to the investment's entity tag
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
