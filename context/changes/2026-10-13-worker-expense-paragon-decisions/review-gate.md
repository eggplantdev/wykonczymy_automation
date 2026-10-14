# Review-gate ledger — worker-expense-paragon-decisions (EX-1053) · 2026-10-13

Scope: `7d8228308...HEAD` (64 files). Step 0.5 skipped — the browser pass drives Playwright, which runs only on an explicit ask.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `src/lib/actions/transfers.ts:170` · draft booking path lacked plan §2.3's `{ deferRefresh: true }` — and `deferRefresh` alone is a no-op: the transactions afterChange hook expires its tags with EXPIRE_NOW (EX-850). From a zgłoszenie the action passes `context.deferRefresh` and `recalcAfterChange` expires its own tags with EXPIRE_NEXT (moved there by the simplify altitude pass — the first fix copied the hook's tag list into the action)
      test: test-driven-debugging · integration — `worker-expense-drafts.db.test.ts` (actions) asserts no EXPIRE_NOW and the kasa / investment tags at EXPIRE_NEXT; red before the fix (hook fired 3× immediately)
- [x] 🟡 WARNING · fixed · code-review · `src/lib/db/worker-expense-drafts.ts:172` · Historia: every paragon row of a zgłoszenie carried the zgłoszenie's counter instead of its own status (change.md: „each paragon row carries its own status") — the counter now rides only the draft-level row, which `PARAGON_SELECT` marks itself (`is_paragon_row`)
      test: test-driven-debugging · integration — `worker-expense-drafts.db.test.ts` (db) „in the history each paragon row shows its own status”; red before
- [x] 🟡 WARNING · skipped · code-review · `src/lib/db/worker-expense-drafts.ts` · duplicates inside one merged zgłoszenie are never matched against each other (`notBookedFrom` skips the zgłoszenie probed) — the user's queued follow-up, handled right after this gate; recorded in change.md „Open for the plan”
      test: TDD · integration — authored with the follow-up
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/db/worker-expense-drafts.ts:497` · a skipped paragon's `read_row` is stored unclamped, so an out-of-range row counted toward settling and could close a zgłoszenie early — `insertDecisions` now stores a skipped read row only inside the read, like `ownReadRows` does for transakcje (first fix filtered in settle only; the altitude pass moved it to the insert, which also keeps it out of the clash check and the counter)
      test: test-driven-debugging · integration — „a paragon refused off the end of the read settles nothing” (now also asserts nothing is stored); red before
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/components/forms/expense-form/use-paragon-decisions.ts:88` · a failed re-read after a refusal left the dialog silently on a stale list — now says so
      test: test-driven-debugging · unit (DOM) — `paragon-resync.test.tsx` „says so when the re-read fails too”; red before
- [x] 🟡 WARNING · fixed · simplify (altitude) · `src/lib/db/worker-expense-drafts.ts:285` · regression from the Step 1 history fix: the mapper guessed „paragon row” from `transfers.length > 0`, but in the pending queue (`DRAFT_SELECT`) `transfers` is every transakcja of the zgłoszenie — a partly decided zgłoszenie lost its counter there. `PARAGON_SELECT` now emits `is_paragon_row`; `DRAFT_SELECT` never does
      test: test-driven-debugging · integration — „in the pending queue a partly decided zgłoszenie keeps its counter”; red before
- [x] 🔵 OBSERVATION · dismissed · code-review · `use-paragon-decisions.ts:108` · onSubmit field errors outliving an edit — TanStack form-core 1.28 clears `errorMap.onSubmit` on the next change (`FieldApi.validateSync`), and `validateSubset` clears stale ones before each check
- [x] 🔵 OBSERVATION · dismissed · impl-review · `form-dialog.tsx` · `onClose` can fire twice (submit then dismiss) — the only caller's refresh is idempotent
- [x] 🔵 OBSERVATION · dismissed · impl-review · `lib/actions/worker-expense-drafts.ts` · the paragon reject action revalidates nothing — drafts list and queue are uncached; the dialog's close-time `router.refresh()` is what refreshes them
- [x] 🔵 OBSERVATION · dismissed · code-review · `pending-expense-drafts.tsx:90` · selection actions show only with >1 row ticked — plan decision, covered by a manual check
- [x] 🔵 OBSERVATION · dismissed · code-review · `transfers.ts` · a forged media id in `receiptMediaIds` — management-only action, and `ownPages` drops any id not on the draft
- [x] fixed · code-review · `use-paragon-decisions.ts:241` · `isDeciding` returned but read by nobody — dropped from the return
- [x] fixed · module-cohesion-audit · `src/lib/db/worker-expense-drafts.ts:405` · `decideExpenseDraft` / `decideExpenseParagons` duplicated the decision mapper and both INSERT CTEs (`ownPages` / `ownReadRows`) — extracted `decisionRows` + `insertDecisions`; `rejectPendingParagons` reuses `DECIDED_READ_ROWS` instead of its inline copy
- [x] skipped · module-cohesion-audit · `src/lib/db/worker-expense-drafts.ts` · file is ~900 lines; proposal to extract `worker-expense-draft-decisions.ts` — the dedup above removed the real duplication; a file split is churn with no behaviour or reuse win now
- [x] fixed · structure-scatter-audit · `src/lib/worker-expenses/read-row-of.ts`, `receipt-refusal.ts` · two one-function files over `DraftReceiptT` beside `receipt-decision.ts` — folded into it, specs folded into `receipt-decision.test.ts`
- [x] dismissed · structure-scatter-audit · `src/lib/worker-expenses/ordered-entries.ts` · could move to `lib/utils` — its ordering rule (photos order, unread last) is worker-expense domain, not a generic util
- [x] dropped · feature-first-structure · `DecisionStatusT` / `DraftProgressT` / `ParagonDecisionT` · three near-vocabularies could share one type in `src/types/` — each is local to its surface; merging buys nothing today
- [x] fixed · code-review · `src/lib/actions/transfers.ts:34` · unused `logError` import (predates EX-1053, file touched anyway) — removed
- [x] fixed · comment-noise-audit · `use-expense-draft-acceptance.tsx:96` · restated the link-not-upload rationale already on `draftMediaIds` in `expense-form.tsx` — deleted
- [x] fixed · comment-noise-audit · `worker-expense-drafts.db.test.ts:421` · vanished-state „no longer” — reworded
- [x] dismissed · comment-noise-audit · `expense-form.tsx:173`, `:129`, `line-items-field.tsx:510`, `form-dialog.tsx:13`, `worker-report-status-badge.tsx:30`, `submit-with-uploads.ts:77`, `expense-draft-sort.ts:8`, `expense-form-merge.test.tsx:91`, `:152` · each carries a why the code can't say (link instead of re-upload, paragon-mode rule, `key={status}` remount, `onClose` vs submit, empty report reads as status, page-id interleaving, the sort whitelist, test ordering) — kept
- [x] dropped · comment-noise-audit · `worker-expense-drafts.db.test.ts:862` · describe preamble half-restates the block name — not worth the churn
- [x] dismissed · tailwind-v4-audit · — · no findings
- [x] fixed · simplify (altitude + reuse + simplification) · `src/lib/actions/transfers.ts:214` · the action rebuilt the hook's kasa / investment tag list by hand to expire it deferred — two copies to keep in step; replaced by the hook honouring `context.deferRefresh` (`recalculate-balances.ts`), manual block and two imports gone; EX-850 note in `revalidate.ts` updated
- [x] fixed · simplify (reuse) · `src/lib/db/worker-expense-drafts.ts:475` · `decideExpenseDraft` spelled out its own `READ_COUNT` CASE beside the shared fragment both decide paths now feed into `insertDecisions` — uses `${READ_COUNT}`
- [x] fixed · simplify (simplification) · `src/lib/db/worker-expense-drafts.ts:559` · `decideExpenseParagons` mapped the decision twice (`decisionRows` for the clash check, again inside `insertDecisions`) — `insertDecisions` takes the mapped rows
- [x] fixed · simplify (simplification) · `src/components/forms/expense-form/use-draft-receipts.ts:17` · two imports from `receipt-decision` after the fold — merged
- [x] dismissed · simplify (simplification) · `use-paragon-decisions.ts:65` · `isDeciding` state still feeds `isBusy` for refuse / undo, which bypass `submit` — only its return was dead
- [x] dismissed · simplify (efficiency) · `worker-expense-drafts.ts` settle · `READ_COUNT` evaluated per decided row — a few dozen calls on one row, once per decision
- [x] dismissed · primitive-reuse-scan · — · no new UI in the fixes; the slice's UI was scanned at implement time

## Simplify pass

Ran /simplify (4 angles) over the Step 1 fixes — 5 applied (one a regression, test-driven), 0 proposed, 3 dismissed; each finding folded into ## Findings (tagged simplify). No separate report.

## Tests & suite

- Whole-tree gate (end of /10x-implement, 2026-10-13): typecheck clean; lint — 0 errors in changed files (449 errors all in untracked `.playwright-mcp/` scratch); `pnpm test` 7 failed (kosztorys editor DOM specs), `pnpm test:integration` 3 failed (`read-expense-draft-receipts.db`, `accept-worker-report`) — all 10 fail identically on `7d8228308`, before EX-1053.
- After the gate's fixes: typecheck clean; eslint clean on changed files; touched specs green — drafts DB 46, action DB 6, related unit/DOM 26 files / 230. Full suite not re-run (the fixes are covered by those specs; the full run waits for an explicit ask).
- E2E: none owed — the plan routed every risk to DB integration and DOM specs (plan.md „What we're NOT doing”); the browser flow is covered by the manual checks in `context/foundation/manual-checks.md` § 2026-10-13 EX-1053 (one box added by this gate: per-row status in the history, counter in the queue).
