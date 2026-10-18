if# Review-gate ledger — commits of 2026-10-17 and 2026-10-18 · 2026-10-18

Scope: `c713fa2bf..2dceae2a5` on `staging` (`cd200725f` is the first commit), 415 files, +3237 / −11808.
It covers more than EX-783: the dead-code cleanup, the filter restore (`cd200725f`) and the
`transfer-actions-db-spec` implementation (EX-911, plan read from `61a746a9e^`).

Not run:

- Step 0.5 browser pass: no browser use unless asked.
- `tailwind-v4-audit`: the diff adds no `className`.
- `feature-first-structure`: the diff adds no production file.

## Findings

- [x] 🔴 CRITICAL · fixed · `test-review` · `src/__tests__/hooks/transfers/delete-invoice-media.test.ts:57` · phase 2 dropped 'keeps a page another expense still references'; the helper spec can't see whether the hook calls the helper — case restored
      test: test-driven-debugging · unit — restored case, green
- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/actions/transfers.ts:248` · two concurrent cancels both passed the `cancelled` check and wrote two CANCELLATION rows — `fetchAndAuthorize` now runs inside the transaction after `lockTransactionRow` (`SELECT … FOR UPDATE`); impl-review F4 is the same finding
      test: test-driven-debugging · integration — `transfers.db.test.ts:531` 'cancels once when two cancels of the same transfer race' was red, now green
- [x] 🟡 WARNING · fixed · `test-review` · `src/__tests__/lib/kosztorys/print/offer.test.ts:93` · the colspan regex never captured, so every span read as 1 — now matches each `<td>` and reads its `colspan`
      test: no automated test · unit — the fix is to the guard itself; mutation-checked by the reviewer
- [x] 🟡 WARNING · fixed · `test-review` · `src/__tests__/lib/actions/transfers.test.ts:335` · the zero-amount row lacked `expenseCategory`, so it was refused for the wrong reason
      test: no automated test · unit — the fixture fix is the test
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/actions/transfers.ts:248` · an edit racing a cancel left the cancelled row unequal to its CANCELLATION; `previousAmount` read a pre-lock amount — same lock, every figure now read under it
      test: no automated test · integration — same lock as the cancel race, which the race case pins
- [x] 🔵 OBSERVATION · fixed · `test-review` · `src/__tests__/leads/store-lead.test.ts:24` · 'returns the existing sibling' restored — the DB case can't see the early return
      test: test-driven-debugging · unit — restored case, green
- [x] 🔵 OBSERVATION · fixed · `test-review` · `src/__tests__/lib/actions/transfers.test.ts:697` · missing `flushAfter()` let the `after()` callback leak into the next case
      test: no automated test · unit — the flush is the fix
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/kosztorys/row-conditions/registry.ts:207` · the comment claimed different semantics from the code; behaviour matches pre-`909fb0879` and the owner's reading — comment corrected, the „bez przedmiaru" contrast moved onto `isEmptyOnBothAxes`
      test: no automated test · unit — comment-only
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/migrations/20261015_0_document_settings_column_map.ts` · `down` silently needs the code rolled back past `280980002` — said so in the header
      test: no automated test — comment-only
- [x] 🔵 OBSERVATION · dismissed · `impl-review` F1 · `transfers.db.test.ts` · „Pozostało" baseline read from code under test — accepted, documented drift in the plan
      test: no automated test — dismissed
- [x] 🔵 OBSERVATION · fixed · `impl-review` F2 · `src/lib/actions/transfers.ts` · two comments explained the same sheet-sync ownership — merged into one sentence
      test: no automated test — comment-only
- [x] 🔵 OBSERVATION · fixed · `impl-review` F3 · `context/foundation/test-plan.md` · rollout row 2 still read `not started` — now `implementing`, #3 done
      test: no automated test — doc
- [x] 🔵 OBSERVATION · fixed · `impl-review` F5 · `transfers.db.test.ts:76` · booking date in UTC — `warsawToday()`
      test: no automated test — the fixture fix is the test
- [x] 🔵 OBSERVATION · dismissed · `impl-review` F6 · `transfers.db.test.ts` · cancel/edit cases depend on the ledger case and run order — single-scenario design the plan accepted
      test: no automated test — dismissed
- [x] fixed · `code-review` · `scripts/inspect-sheet.mjs` · fallback to `KOSZTORYS_TEMPLATE_SHEET_ID` that nothing sets — `SHEET_ID` only; `kosztorys-editor-domain-notes.md` and `roadmap.md` commands now pass it
- [x] fixed · `code-review` · `package.json:16` · unpinned `npx knip` — `knip@6.41.0`
- [x] fixed · `code-review` · `src/lib/kosztorys/client-view/settings.ts:67`, `worker-view/settings.ts:64` · `toStored*` re-implemented the sanitize step — spread the sanitized settings
- [x] fixed · `code-review` · `template-action.ts` · race comment describing a handled case — removed
- [x] dropped · `code-review` · `icon.tsx` · swap the hand-drawn icon for lucide — would change the look
- [x] dismissed · `code-review` · `resolveHiddenColumns` · reject arrays explicitly — same result as today
- [x] fixed · `structure-scatter-audit` · `src/__tests__/transfer-actions.test.ts` · root-level spec for `lib/actions/transfers.ts` — moved to `src/__tests__/lib/actions/transfers.test.ts`
- [x] filed · `structure-scatter-audit` · `src/__tests__/*.test.ts` · root junk drawer of unmirrored specs — filed EX-1084
- [x] fixed · `structure-scatter-audit` · 15 specs · hand-rolled `requireAuth` stubs — adopt the shared stub
- [x] fixed · `structure-scatter-audit` · 6 specs · inline first-user lookups — adopt `firstUserId`
- [x] skipped · `structure-scatter-audit` · role-gated stub · fold role-gated auth into the shared stub — changes behaviour across 51 consumers; not worth the churn here
- [x] fixed · `module-cohesion-audit` · `src/lib/actions/transfers.ts:415` · `invoiceOf` JSDoc read as describing the helper — rewritten as the invoice-actions note
- [x] fixed · `module-cohesion-audit` · `src/lib/actions/transfers.ts` · two imports from `@/lib/constants/transfers` — merged
- [x] dropped · `module-cohesion-audit` · `toStored*` generic helper — two one-liners after the simplify, no win
- [x] dropped · `module-cohesion-audit` · trash-contract note — restates code
- [x] dismissed · `module-cohesion-audit` · module splits — files stay one concern each
- [x] dropped · `structure-scatter-audit` · existing per-entity trash probes — pre-existing, not this diff
- [x] fixed · `comment-noise-audit` · ~20 test and helper files · Deleted/Trimmed/Flagged buckets applied (`canonical-snapshot.ts`, `first-user-id.ts`, `transfers.db.test.ts`, kosztorys specs, client-/worker-view settings)
- [x] fixed · `code-review` · phase-2/phase-3 ledgers · stale line citations — re-pointed; phase-2 store-lead and delete-invoice-media rows note the restore
- [x] fixed · `simplify` · `src/lib/actions/transfers.ts` · dead `const { original } = result` after the lock rewrite — removed
- [x] fixed · `simplify` · `src/lib/actions/transfers.ts:248` · the `cancelled` check ran twice (before the transaction and after the lock) and a missing row reported „już anulowana" — lock first, one check under it; `lockTransactionRow` is now a bare `SELECT 1 … FOR UPDATE`
- [x] fixed · `simplify` · `context/foundation/test-plan.md:87` · risk #3 row didn't name the race case — added

## Simplify pass

Ran /simplify — 4 agents; reuse clean, efficiency clean, simplification 4 applied / 1 dropped (a redundant comment rewrite), altitude 2 applied (lock-before-read, roadmap command) + 1 test-plan gap. Each finding is folded into ## Findings, tagged `simplify`.

## Tests & suite

- typecheck — green
- DB specs one at a time on 5435: `transfers.db` 15 ✓, `kosztorys-presets` 19 ✓, `kosztorys-delete-guard` 3 ✓, `kosztorys-snapshots` 2 ✓; the 21 stub/`firstUserId` specs 163 ✓ (agent run)
- unit: `transfers.test.ts` + row-conditions 209 ✓; restored/fixed specs + client-/worker-view 159 ✓
- full suite — awaiting the user's go
- manual checks — `manual-checks.md` § EX-911 (3 unticked) covers cancel and amount edit, which the lock change sits on
