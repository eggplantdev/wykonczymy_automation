# Review-gate ledger — investment-status-rejected (EX-1066) · 2026-10-15

Base: `staging` (merge-base `24f230acb`). Step 0.5 (browser verification) skipped — no browser pass
unprompted; manual checks live in `context/foundation/manual-checks.md` § EX-1066.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `plan.md` Progress 1.3, 1.4, 2.1–2.3 · touched specs + typecheck not run — run on the user's go (typecheck + touched specs), all green
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/constants/investment-status.ts:4` · `INVESTMENT_STATUSES` over 100 cols — wrapped like its siblings
- [x] 🔵 OBSERVATION · fixed · impl-review / code-review / reuse / altitude · `src/lib/db/snapshots.ts:83` · bare `'rejected'` literal in the snapshot SQL — now `sqlList([...CLOSED_INVESTMENT_STATUSES, TEMPLATE_INVESTMENT_STATUS])`
      test: no automated test — rename-safety only; the exclusion itself is pinned by `capture-daily-snapshots.test.ts`
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/constants/investment-status.ts:4` · `rejected` before `szablon` vs plan's „after completed” — same position, no behavioural difference
- [x] 🔵 OBSERVATION · dismissed · impl-review · migration · `down` is a no-op — Postgres has no DROP VALUE; rollback UPDATE documented in the plan
- [x] 🔵 OBSERVATION · dismissed · impl-review · `entity-combobox-field.tsx` · a held Wycena/Odrzucona stays bookable via the kept selection — deliberate (EX-643 + no server lock, owner ruling)
- [x] dismissed · impl-review / code-review · `src/scripts/fill-*-translations.ts`, `catalogue-usage.ts` · still include Odrzucona — one-off scripts / translation is harmless; the slice only excludes snapshots
- [x] dismissed · impl-review · `src/lib/db/worker-reports.ts:113` · report links on an Odrzucona stay live — status is a label, not a gate (owner ruling)
- [x] dismissed · code-review / feature-first / efficiency · `deposit-form.tsx:212`, `expense-form.tsx:438` · `.filter(isBookableInvestment)` under `fixedFilter` looks redundant — it still drops a held Zakończona from new-booking drafts; pre-existing behaviour, decided to keep
- [x] skipped · simplify (altitude) · same lines · altitude reads the same pre-filter as the reverse of EX-643 (held Zakończona hidden while the id still submits) — pre-existing, and removing it changes what a user sees; out of this slice
- [x] fixed · simplify (simplification + altitude) · `src/lib/constants/investment-status.ts` · tuple + `as readonly string[]` + a completeness spec compensating for `{status: string}` — now `OFFERED_FOR_BOOKING: Record<InvestmentStatusT, boolean>`, completeness enforced by tsc
- [x] fixed · simplify (altitude) · `investment-data-table.tsx:86`, `snapshots.ts` · „closed” (completed + rejected) spelled in two places — one `CLOSED_INVESTMENT_STATUSES` / `isClosedStatus`; the one-consumer `REJECTED_INVESTMENT_STATUS` dropped
- [x] fixed · simplify (altitude) · `src/lib/constants/investment-lock.ts:46` · `isBookableInvestment` docblock still called itself „the pickers' courtesy filter” — rewritten to point booking pickers at `isOfferedForBooking`
- [x] fixed · simplify (simplification) · `guard-template-status.test.ts:25,34` · the five-status literal list written twice — derived from `INVESTMENT_STATUSES`
- [x] dropped · simplify (simplification) · `stamp-completed-at.test.ts:52` · explicit status list could be derived — an explicit list is deliberate there
- [x] dropped · simplify (simplification) · `use-status-filter.test.ts:225` · awkward prettier wrap — cosmetic
- [x] dropped · simplify (altitude) · `entity-combobox-field.tsx:90` · empty state „Brak aktywnych inwestycji” with Planowane offered too — unreachable in practice, wording only
- [x] fixed · comment-noise · `src/lib/utils/is-active-ref.ts:20` · „Aktywni is a filter the user can widen…” restated `!activeOnly ||` — deleted
- [x] fixed · comment-noise · `src/lib/db/snapshots.ts:78` · „(a declined offer)” restated the status — trimmed
- [x] dismissed · comment-noise · migration line 3 · „Hand-written…” note — every sibling migration carries it
- [x] dismissed · structure-scatter · `src/__tests__/use-status-filter.test.ts` · unmirrored top-level spec — predates mirroring, only edited here
- [x] dismissed · tailwind-v4-audit · badge / dim classes — clean

## Simplify pass

Ran /simplify (4 angles) — 4 applied, 0 proposed, 6 dismissed/dropped/skipped; each folded into ## Findings (tagged simplify). No separate report file.

## Tests & suite
- typecheck — OK
- unit specs (7 files, 67 tests: use-status-filter, investment-lock, stamp-completed-at, guard-template-status, investment-status, use-investment-from-url, is-active-ref) — OK
- DB specs vs 5435 (investments-status.db, capture-daily-snapshots; 2 files, 8 tests) — OK
- full suite / lint / build / e2e — not run (user chose typecheck + touched specs)
