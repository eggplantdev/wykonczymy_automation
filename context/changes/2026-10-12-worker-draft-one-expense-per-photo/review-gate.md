# Review-gate ledger — worker-draft-one-expense-per-photo · 2026-10-12

Scope: uncommitted work on `staging` vs `HEAD` (69fad70d6), 31 files — the other session's
`investment-ai-stage` files in the same tree are excluded. Checks: `/code-review`,
`tailwind-v4-audit`, `feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`,
`comment-noise-audit`. `/10x-impl-review` dropped (no `plan.md`). Step 0.5 browser pass skipped —
the browser is driven only on an explicit ask; manual checks stay pending.

## Findings

- [x] 🔴 CRITICAL · fixed · code-review · `src/lib/db/worker-expense-drafts.ts:466` · two overlapping
      AI reads („Zobacz" while the send-time one runs) overwrote `ai_read`, so a duplicate hint or a
      skipped paragon's `readRow` could point into a different read than the form was built from —
      `saveExpenseDraftRead` is now first-writer-wins (`ai_read IS NULL … RETURNING`) and returns the
      stored read; `readExpenseDraftReceipts` hands that back
      test: test-driven-debugging · integration — `read-expense-draft-receipts.db.test.ts` „the first
      read stored wins…" was red (received the second read), now green
- [x] 🟡 WARNING · fixed · code-review · `src/components/worker-expenses/expense-draft-dialog.tsx:112`
      · „Jeden wydatek" survived a re-pick down to one photo with the toggle hidden, summing a photo of
      several paragony — sends `one-per-photo` whenever the choice isn't shown
      test: TDD · unit (dom) — `expense-draft-dialog-mode.test.tsx` „drops „Jeden wydatek” once the
      photos are re-picked down to one", red → green
- [x] 🟡 WARNING · fixed · code-review · `src/lib/ai/openrouter.ts:188` · the `amount === null`
      filter in `extractReceipts` could silently drop a legible paragon with a blurry total — filter
      reverted (its unit spec deleted); the live eval compares only entries with a total
      test: no automated test · — the behavior is the model's; live eval `pnpm test:receipts-ai` 15/15
      on three runs after the revert
- [x] 🟡 WARNING · fixed · code-review · `src/lib/actions/worker-expense-drafts.ts:129` · a restored
      skipped paragon with no read row was re-read from the shared photo, returning the paragony the
      parent already booked — the restore now stores an empty read row (`{ mediaIds }`) instead, and
      the `after()` re-read and `hasRead` are gone
      test: test-driven-debugging · integration — `worker-expense-drafts.db.test.ts` „a paragon with
      no read row comes back with an empty read…" was red (`ai_read` null), now green
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/db/worker-expense-drafts.ts:478` · dead
      `scan_mode` / `array_agg(media_id)` compare-and-set in the read save — replaced by the #1 guard
      test: no automated test · — covered by the #1 regression spec
- [x] 🔵 OBSERVATION · skipped · code-review · `src/components/worker-expenses/draft-prefill.ts:54` ·
      a photo shared by N rows is uploaded N times — one media row per transfer is the delete/reclaim
      model, and per-row upload predates this change; sharing a media row is a model change, not a cleanup
      test: no automated test · — not a defect
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/ai/openrouter.ts:188` · `extractReceipts` did
      not log an `UNREADABLE_RECEIPT` entry the way `extractReceipt` does — logs it under the same
      EX-449 path
      test: no automated test · — a log line
- [x] fixed · code-review · `src/lib/actions/read-expense-draft-receipts.ts:52`,
      `src/lib/db/worker-expense-drafts.ts:466` · two docstrings still described page/mode changes and
      matching by `mediaIds` — rewritten with #1
- [x] fixed · code-review / module-cohesion-audit · `src/lib/worker-expenses/receipt-decision.ts:5` ·
      `DraftReceiptT` restated `SkippedReceiptT`'s fields — `Omit<SkippedReceiptT, 'duplicateOf'>`
- [x] fixed · structure-scatter-audit · `src/lib/constants/worker-expense-drafts.ts:21` ·
      `TOO_MANY_DRAFT_PAGES` was dead (already at HEAD) — deleted, typecheck clean
- [x] dropped · feature-first-structure · `src/lib/expense-duplicates/duplicate-of.ts:13` ·
      `skippedReceiptSchema` lives beside the duplicate schema — pre-existing placement, not this change
- [x] fixed · comment-noise-audit · `src/lib/ai/openrouter.ts:36` · comment restating `FIELD_RULES`
      — deleted
- [x] fixed · comment-noise-audit · `src/lib/ai/scan-receipt.ts:38` · comment restating
      `scanReceiptList` — deleted
- [x] fixed · comment-noise-audit · `src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts:246`
      · ticket-number comment restating the `describe` — deleted
- [x] fixed · comment-noise-audit · `src/components/worker-expenses/expense-draft-dialog.tsx:71` ·
      over-long rationale — trimmed to one line
- [x] fixed · comment-noise-audit · `src/lib/ai/openrouter.ts:70` · the „send BYTES, not a URL"
      rationale sat on `extractReceipt` but is about the shared model call — moved to `readWithModel`
- [x] fixed · comment-noise-audit · `src/lib/db/worker-expense-drafts.ts:404` · over-long JSDoc line
      on `restoreSkippedReceipt` — rewrapped with #4
- [x] dismissed · tailwind-v4-audit · — · 0 findings
- [x] fixed · simplify (altitude) · `src/lib/actions/read-expense-draft-receipts.ts:66` · the
      „one photo is read paragon by paragon" rule lived only in the dialog; every single-photo draft
      sent before 2026-10-12 says `one-invoice` and was still read as one document on „Zobacz" — the
      reader now treats a one-page draft as per-photo whatever its mode
      test: TDD · integration — `read-expense-draft-receipts.db.test.ts` „reads a one-photo „Jeden
      wydatek” paragon by paragon", red → green; two specs that used a one-photo invoice moved to two
- [x] skipped · simplify (altitude) · `src/components/worker-expenses/draft-prefill.ts:32`,
      `src/lib/db/worker-expense-drafts.ts:384` · a paragon carries two client-sent keys (`mediaIds` +
      `readRow`) reconciled in prefill, decide and restore; the server could derive `mediaIds` from
      `ai_read -> rows -> readRow` — changes what the server trusts across three paths, a refactor that
      deserves its own review, not a cleanup
- [x] skipped · simplify (efficiency) · `src/components/worker-expenses/draft-prefill.ts:41` · a photo
      with N paragony is uploaded N times on accept — same as code-review #7 (media row per transfer)
- [x] fixed · simplify (reuse) · `src/__tests__/lib/ai/extract-receipts-live.test.ts:12` · a hand
      extension→mime map — `sniffMime` reads it from the bytes
- [x] fixed · simplify · `src/__tests__/components/worker-expenses/worker-expense-drafts-table.test.tsx:103`
      · asserted the absence of „Edytuj wydatek", which nothing renders any more — deleted
- [x] fixed · simplify · `src/lib/actions/worker-expense-drafts.ts:48` · `findDraftTargetError` mixed
      destructured and `target.` access — destructures all three
- [x] fixed · simplify · `src/components/worker-expenses/expense-draft-dialog.tsx:33` · the default
      mode spelled three times — `DEFAULT_SCAN_MODE`
- [x] fixed · suite · `src/__tests__/transfer-constants.test.ts:182` · `carriesPayoutStatus` (081e83518)
      and `isInvestmentExpense` were exported with no truth-table row, so „covers every exported
      predicate" failed at HEAD — both rows added as hand-typed literals
- [x] fixed · suite · `src/__tests__/components/transfers/transfer-data-table-language.test.tsx:63` ·
      the „Data decyzji" column (081e83518) also matched `/Data/` and `/Дата/` — anchored to the
      exact header
- [x] fixed · suite · `src/__tests__/lib/actions/kosztorys-stages.test.ts:56`,
      `src/__tests__/lib/actions/kosztorys-import.test.ts:66` · both took the first user in the DB as
      their etap worker; on 5435 that one is trashed, so every etap write was refused („Pracownik jest
      w koszu") — 8 red; the fixture now skips trashed users
- [x] dismissed · eslint · `src/lib/ai/openrouter.ts:83` · `generateObject` deprecated — pre-existing
      at HEAD, not this change

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude) — 5 applied, 0 proposed, 2 skipped;
each folded into ## Findings (tagged simplify). No separate report.

## Tests & suite

- Typecheck: clean. ESLint on the touched files: 0 errors (1 pre-existing deprecation warning).
- DB specs: `read-expense-draft-receipts` + `worker-expense-drafts` (db, actions, worker) 58/58
  (5435; `20261012_1` applied there by hand — `payload migrate` would also have applied another
  session's uncommitted `20261012_0`).
- `__tests__/components/worker-expenses/` + `__tests__/lib/worker-expenses/` 57/57.
- `pnpm test`: 3 failed / 5813 passed — all three red at HEAD from 081e83518 (payouts), fixed
  above; both specs 455/455 after the fix.
- `pnpm test:integration`: 8 failed (trashed fixture worker, fixed above), then 792/792.
- Live eval `pnpm test:receipts-ai`: 15/15 × 3.
