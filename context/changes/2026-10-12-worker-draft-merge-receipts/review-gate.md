# Review-gate ledger — worker-draft-merge-receipts (EX-1048) · 2026-10-13

Scope: `ac0ac46b6...HEAD` on branch `worker-draft-merge-receipts` (44 files). Step 0.5 browser pass
skipped — it drives Playwright, not asked for this run; manual checks live in
`context/foundation/manual-checks.md` § worker-draft-merge-receipts.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `src/components/forms/expense-form/use-draft-receipts.ts:73` · merging an already-merged short row again dropped „nie odczytano” — the merged-in row's blank Kwota is hidden inside its sum, so the flag is now carried from the merged-away rows
      test: test-driven-debugging · unit (DOM) — `expense-form-merge` „keeps „nie odczytano” when a short merged row is merged again”, red before the fix, green after
- [x] 🟡 WARNING · dismissed · impl-review · `src/migrations/20261013_1_add_draft_transfer_read_rows.ts` · prod migration must precede the push — deploy-time gate, no code change: additive, `pnpm db:migrate:prod` before pushing, `pnpm db:migrate:preview` after the merge to staging
- [x] 🟡 WARNING · dismissed · code-review · `src/components/forms/expense-form/use-draft-receipts.ts` · „Duplikat” on a merged row refuses every paragon in it — planned behaviour (plan.md:43, :302; research.md:155), pinned by the existing spec; „Rozłącz” first to mark one
- [x] 🟡 WARNING · dismissed · code-review (= impl-review F3) · `src/components/forms/expense-form/expense-form.tsx` · „nie odczytano” never clears after the manager types a Kwota — mirrors the existing scan-failure `failedIds` marker, the label is owner-specified, and it errs safe
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/forms/expense-form/use-draft-receipts.ts:67` · merged pages uploaded under camera filenames — now named after the first read paragon
      test: TDD · unit (DOM) — `expense-form-merge` „names the merged pages after the first read paragon, not the camera file”, red before the fix
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/worker-expenses/expense-draft-duplicate-hints.tsx` · hint row key collided for two paragony merged into one row, and a dismissal was lost on merge/split — key is now `${paragonReadRow}-${key}`
      test: test-driven-debugging · unit (DOM) — `expense-draft-duplicate-mark` „keeps one hint per paragon when two merged into one row match the same transakcja”, red before the fix
- [x] 🔵 OBSERVATION · skipped · impl-review (= code-review O4) · `src/lib/db/expense-duplicate-candidates.ts` · a mixed merge (read + blank part) books `read_rows` of cardinality 1, so no per-paragon candidate — narrow, plan-intended, fixing it needs a part-count design
      test: no automated test · — not fixed; behaviour is plan-intended
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/__tests__/components/worker-expenses/worker-expense-drafts-table.test.tsx:179` · failing spec — pre-existing on base `ac0ac46b6`
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/i18n/**` · ru/uk `scanMode` keys left behind — the four strings now live as literals in `line-items-field.tsx` (management UI is Polish-only) and the keys are gone from pl/uk/ru (applied in the simplify pass)
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/forms/expense-form/expense-form.tsx` · „Wyczyść” leaves the receipts map untouched — pre-existing; selected/incomplete flags are already filtered by live row ids
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/forms/form-fields/line-items-field.tsx` · hard-coded Polish strings — management UI stays Polish; no worker-dialog leftovers
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/db/worker-expense-drafts.ts` · skipped-receipt insert doesn't range-check `read_row` — pre-existing CTE; restore handles out-of-range safely
- [x] dropped · code-review · `src/components/forms/expense-form/use-draft-receipts.ts` · merge discards page edits the manager made to the merged-away rows — merge rebuilds from the worker's photos, same as split
- [x] fixed · feature-first-structure · `src/lib/worker-expenses/merge-receipts.ts` · lib imported a components type — `mergeLineItems` moved to `forms/expense-form/merge-line-items.ts`, `bookedReceipt` folded into `receipt-decision.ts`, `merge-receipts.ts` deleted
- [x] fixed · feature-first-structure · `src/components/forms/expense-form/use-draft-receipts.ts` · `ReceiptGroupingT` exported from a hook file — moved to `bulk-expense-form.ts`
- [x] dismissed · feature-first-structure · `src/components/forms/expense-form/use-draft-receipts.ts:8` · form hook imports from `worker-expenses/draft-prefill` — deliberate coupling: split rebuilds rows exactly as the prefill does
- [x] dropped · tailwind-v4-audit · `src/components/forms/form-fields/line-items-field.tsx` · `mt-8.5` magic offset — aligns the checkbox with the first input row; not worth a token
- [x] fixed · comment-noise-audit · 6 files · 9 restating comments deleted, 2 trimmed (`use-draft-receipts` JSDoc, `read-expense-draft-receipts` category note)
- [x] fixed · simplify · `src/components/forms/expense-form/use-draft-receipts.ts` · hand-rolled set toggle — reuses `toggleInSet`
- [x] fixed · simplify · `src/components/worker-expenses/draft-prefill.ts` · merge and split each built and renamed pages — shared `pagesFor`
- [x] fixed · simplify · `src/components/worker-expenses/draft-prefill.ts` · `PartWithReadT` threaded the read alongside every part — `readOf` + `lineItemForPart(part, aiReadRows, …)` look it up
- [x] fixed · simplify · `src/components/forms/expense-form/merge-line-items.ts` · Kwota summed via a grosze round-trip — `roundToCents` over the plain sum
- [x] fixed · simplify · `src/lib/db/expense-duplicate-candidates.ts` · the read-row filter duplicated in two queries — `readRowMatches`
- [x] fixed · simplify (altitude) · `src/components/forms/expense-form/expense-form.tsx` · merge button and „nie odczytano” wired in the form beside `LineItemsField` — moved into `ReceiptGroupingT` / `LineItemsField`; the button also stops showing on a deposit type
- [x] fixed · simplify · `src/components/forms/expense-form/use-draft-receipts.ts` · `incompleteIds` trimmed on split and filtered on return — grow-only, since a row id is never reused
- [x] fixed · simplify · `src/lib/worker-expenses/receipt-decision.ts` · the invariant spec re-implemented the parts-map updates — `mergeParts` / `splitParts` exported, the hook and the spec share them
- [x] fixed · simplify · `src/lib/ai/scan-receipt.ts` · `scanReceiptPages` kept only for the deleted `readInvoice` — folded back into `scanReceipt`
- [x] fixed · simplify · `src/lib/constants/receipt-scan.ts` · `RECEIPT_SCAN_MODES` array read only for its type — literal union `ScanModeT`
- [x] fixed · simplify · `src/lib/constants/worker-expense-drafts.ts` · `MAX_DRAFT_PAGES` aliased `MAX_RECEIPT_PAGES` under a comment that is no longer true (a draft is read page by page) — its own constant
- [x] fixed · simplify · `src/components/worker-expenses/expense-draft-duplicate-hints.tsx` · two chained `flatMap`s and a stale `lineItemIds` comment — one pass, comment says what the prop is for
- [x] fixed · simplify · `src/lib/db/worker-expense-drafts.ts` · `decided.read_rows` (jsonb) shadowed the `read_rows int[]` column it fed — `read_count`
- [x] skipped · simplify · `src/components/forms/expense-form/expense-form.tsx` · `duplicateOf` state could move into `useDraftReceipts` — review-worthy refactor needing removal plumbing through the form
- [x] skipped · simplify · `src/lib/db/worker-expense-drafts.ts` · `scan_mode` column default / INSERT now constant — a schema change; the column drop is the planned later destructive step
- [x] dropped · simplify · `src/__tests__/components/worker-expenses/draft-prefill.test.ts` · a `draftPrefill(overrides)` helper for the prefill literals — each case's literal is its spec; a helper hides the input

## Simplify pass

Ran /simplify (4 agents: reuse / simplification / efficiency / altitude) — 13 applied, 2 skipped, 1 dropped, efficiency clean; each folded into ## Findings (tagged `simplify`).

## Tests & suite

- typecheck — clean (apart from the pre-existing `importMap.js` errors).
- eslint on changed sources — 0 errors; 1 pre-existing warning (`logError` unused in `lib/actions/transfers.ts`, already on base).
- touched specs after simplify (`__tests__/components/forms/expense-form`, `__tests__/components/worker-expenses`, `__tests__/components/tables`, `__tests__/lib/worker-expenses`, `__tests__/lib/ai/scan-receipt`) — 177/179; both reds (`expense-drafts` „shows a dash…”, `worker-expense-drafts-table` „links a manager…”) fail identically on `main`.
- whole-tree gate from `/10x-implement` (earlier this session) — reds only pre-existing: `expense-drafts` „shows a dash…”, `worker-expense-drafts-table` „links a manager…”, `kosztorys-editor-toolbar` ×5, integration `accept-worker-report` (EX-1049).
- full suite re-run after the gate fixes — not run (asks first).
