# Review-gate ledger — worker-expense-paragon-decisions (EX-1053) · 2026-10-13

Scope: `7d8228308...HEAD` (64 files). Step 0.5 skipped — the browser pass drives Playwright, which runs only on an explicit ask.

## Findings

- [x] 🟡 WARNING · skipped · code-review · `src/lib/db/worker-expense-drafts.ts` · duplicates inside one merged zgłoszenie are never matched against each other (`notBookedFrom` skips the zgłoszenie probed) — the user's queued follow-up, handled right after this gate; recorded in change.md „Open for the plan”
      test: TDD · integration — authored with the follow-up
- [x] 🔵 OBSERVATION · dismissed · code-review · `use-paragon-decisions.ts:108` · onSubmit field errors outliving an edit — TanStack form-core 1.28 clears `errorMap.onSubmit` on the next change (`FieldApi.validateSync`), and `validateSubset` clears stale ones before each check
- [x] 🔵 OBSERVATION · dismissed · impl-review · `form-dialog.tsx` · `onClose` can fire twice (submit then dismiss) — the only caller's refresh is idempotent
- [x] 🔵 OBSERVATION · dismissed · impl-review · `lib/actions/worker-expense-drafts.ts` · the paragon reject action revalidates nothing — drafts list and queue are uncached; the dialog's close-time `router.refresh()` is what refreshes them
- [x] 🔵 OBSERVATION · dismissed · code-review · `pending-expense-drafts.tsx:90` · selection actions show only with >1 row ticked — plan decision, covered by a manual check
- [x] 🔵 OBSERVATION · dismissed · code-review · `transfers.ts` · a forged media id in `receiptMediaIds` — management-only action, and `ownPages` drops any id not on the draft
- [x] skipped · module-cohesion-audit · `src/lib/db/worker-expense-drafts.ts` · file is ~900 lines; proposal to extract `worker-expense-draft-decisions.ts` — the dedup above removed the real duplication; a file split is churn with no behaviour or reuse win now
- [x] dismissed · structure-scatter-audit · `src/lib/worker-expenses/ordered-entries.ts` · could move to `lib/utils` — its ordering rule (photos order, unread last) is worker-expense domain, not a generic util
- [x] dropped · feature-first-structure · `DecisionStatusT` / `DraftProgressT` / `ParagonDecisionT` · three near-vocabularies could share one type in `src/types/` — each is local to its surface; merging buys nothing today
- [x] dismissed · comment-noise-audit · `expense-form.tsx:173`, `:129`, `line-items-field.tsx:510`, `form-dialog.tsx:13`, `worker-report-status-badge.tsx:30`, `submit-with-uploads.ts:77`, `expense-draft-sort.ts:8`, `expense-form-merge.test.tsx:91`, `:152` · each carries a why the code can't say (link instead of re-upload, paragon-mode rule, `key={status}` remount, `onClose` vs submit, empty report reads as status, page-id interleaving, the sort whitelist, test ordering) — kept
- [x] dropped · comment-noise-audit · `worker-expense-drafts.db.test.ts:862` · describe preamble half-restates the block name — not worth the churn
- [x] dismissed · tailwind-v4-audit · — · no findings
- [x] dismissed · simplify (simplification) · `use-paragon-decisions.ts:65` · `isDeciding` state still feeds `isBusy` for refuse / undo, which bypass `submit` — only its return was dead
- [x] dismissed · simplify (efficiency) · `worker-expense-drafts.ts` settle · `READ_COUNT` evaluated per decided row — a few dozen calls on one row, once per decision
- [x] dismissed · primitive-reuse-scan · — · no new UI in the fixes; the slice's UI was scanned at implement time

## Simplify pass

Ran /simplify (4 angles) over the Step 1 fixes — 5 applied (one a regression, test-driven), 0 proposed, 3 dismissed; each finding folded into ## Findings (tagged simplify). No separate report.

## Tests & suite

- Whole-tree gate (end of /10x-implement, 2026-10-13): typecheck clean; lint — 0 errors in changed files (449 errors all in untracked `.playwright-mcp/` scratch); `pnpm test` 7 failed (kosztorys editor DOM specs), `pnpm test:integration` 3 failed (`read-expense-draft-receipts.db`, `accept-worker-report`) — all 10 fail identically on `7d8228308`, before EX-1053.
- After the gate's fixes: typecheck clean; eslint clean on changed files; touched specs green — drafts DB 46, action DB 6, related unit/DOM 26 files / 230. Full suite not re-run (the fixes are covered by those specs; the full run waits for an explicit ask).
- E2E: none owed — the plan routed every risk to DB integration and DOM specs (plan.md „What we're NOT doing”); the browser flow is covered by the manual checks in `context/foundation/manual-checks.md` § 2026-10-13 EX-1053 (one box added by this gate: per-row status in the history, counter in the queue).
