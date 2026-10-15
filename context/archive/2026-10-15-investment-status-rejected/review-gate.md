# Review-gate ledger — investment-status-rejected (EX-1066) · 2026-10-15

Base: `staging` (merge-base `24f230acb`). Step 0.5 (browser verification) skipped — no browser pass
unprompted; manual checks live in `context/foundation/manual-checks.md` § EX-1066.

## Findings

_Trimmed at archive (2026-10-15): `fixed` findings dropped — their record is the commit. Pre-trim tally: 9 fixed, 9 dismissed, 1 skipped, 3 dropped, 0 open._

- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/constants/investment-status.ts:4` · `rejected` before `szablon` vs plan's „after completed” — same position, no behavioural difference
- [x] 🔵 OBSERVATION · dismissed · impl-review · migration · `down` is a no-op — Postgres has no DROP VALUE; rollback UPDATE documented in the plan
- [x] 🔵 OBSERVATION · dismissed · impl-review · `entity-combobox-field.tsx` · a held Wycena/Odrzucona stays bookable via the kept selection — deliberate (EX-643 + no server lock, owner ruling)
- [x] dismissed · impl-review / code-review · `src/scripts/fill-*-translations.ts`, `catalogue-usage.ts` · still include Odrzucona — one-off scripts / translation is harmless; the slice only excludes snapshots
- [x] dismissed · impl-review · `src/lib/db/worker-reports.ts:113` · report links on an Odrzucona stay live — status is a label, not a gate (owner ruling)
- [x] dismissed · code-review / feature-first / efficiency · `deposit-form.tsx:212`, `expense-form.tsx:438` · `.filter(isBookableInvestment)` under `fixedFilter` looks redundant — it still drops a held Zakończona from new-booking drafts; pre-existing behaviour, decided to keep
- [x] skipped · simplify (altitude) · same lines · altitude reads the same pre-filter as the reverse of EX-643 (held Zakończona hidden while the id still submits) — pre-existing, and removing it changes what a user sees; out of this slice
- [x] dropped · simplify (simplification) · `stamp-completed-at.test.ts:52` · explicit status list could be derived — an explicit list is deliberate there
- [x] dropped · simplify (simplification) · `use-status-filter.test.ts:225` · awkward prettier wrap — cosmetic
- [x] dropped · simplify (altitude) · `entity-combobox-field.tsx:90` · empty state „Brak aktywnych inwestycji” with Planowane offered too — unreachable in practice, wording only
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
