# Review-gate ledger — worker-payout-remaining (EX-919) · 2026-09-29

Scope: `git diff 1eaac87e..HEAD -- . ':!context/changes/2026-09-29-global-rabat-on-settlement-axis'`
(staging before the merge `97043b6b` → the post-merge dogfooding fixes `f4eb897d`…`e98f6b5b`).
Step 0.5 skipped: the slice was dogfooded by hand this session; the registry's § EX-919 boxes stay
open for the formal pass.

## Findings

- [x] 🟡 WARNING · dropped · code-review · `settle-payouts-schema.ts:10` · server accepts sub-grosz amounts — no transfer schema in the app enforces precision, the form rounds before sending; only a hand-crafted request reaches it
      test: no automated test — not fixed
- [x] 🔵 OBSERVATION · skipped · impl-review · `src/components/tables/users.tsx` `PayoutRemainingCell` · a worker whose only pairs are withheld shows a green 0,00 zł — changes an owner ruling („green 0 when empty"), so surfaced as a decision box in manual-checks § EX-919, not applied
      test: test-driven-debugging · unit (DOM) — owed with the fix if the owner rules for „—"
- [x] 🔵 OBSERVATION · dismissed · code-review · `/pracownicy` · „Wypłaty" column removed — owner's explicit scope
- [x] 🔵 OBSERVATION · dismissed · code-review · `user-data-table.tsx` · „Filtry (2)" by default — the FilterMultiSelect convention: every ticked toggle narrows
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/tables/investments.tsx:273` · worker count only when > 1, a „Nieprzypisane"-only cell still clickable — deliberate: one worker is named in the dialog, and the dialog shows the unassigned row with its reason
- [x] 🔵 OBSERVATION · dismissed · impl-review · manual checks / plan closure open — process; the slice goes „in review" until § EX-919 is ticked
- [x] dismissed · code-review · `settle-payouts.ts` lock-check loop duplicates the `locked` state — it also catches a trashed investment, which the pair query silently drops (would read as „stale")
- [x] dropped · code-review · `src/lib/queries/investments.ts:33` · two cached reads run the same crew fold — cost once per cache miss; merging reshapes a parity-pinned query
- [x] dropped · module-cohesion / structure-scatter · split `lib/kosztorys/worker-payout-pairs.ts`, rename the db file, move labels to `labels.ts` — optional, cosmetic churn
- [x] dismissed · feature-first-structure / module-cohesion · F2/F4/C3 — placement already correct
- [x] dropped · comment-noise · judgment set (`use-user-list-filters.ts:14`, `kosztorys-subcontractor-due.ts:64`, `settle-payouts-form.tsx` prop docs, `seed-worker-payouts.ts:10`, …) — borderline, each carries some why
- [x] dismissed · tailwind-v4-audit · 0 findings
- [x] filed · simplify (altitude) · `src/components/tables/data-table/data-table-row.tsx` · rows memoize on the `row` object, so column-closure state must ride on the rows (`visibleColumnKey` key suffix, the `user-data-table` map) — shared-engine refactor, ~15 consumers — filed EX-936
      test: TDD · unit (DOM) — recorded in EX-936
- [x] skipped · reuse-scan · `settle-payouts-table.tsx` „Pozostało" cell · not green at zero, unlike the two listings — a visible behaviour change with no recorded intent; not auto-applied
- [x] dropped · reuse-scan · `SettleFigureButton` shared by the two listings — params equal the code (a Button + className)
- [x] dropped · reuse-scan · zero-green class helper — three one-token expressions over different shapes
- [x] dropped · simplify · `countKey` naming nit
- [x] dropped · simplify · owed-rule duplicated between SQL and the pure fold — the pure fold is the pinned reference; merging moves business logic into SQL
- [x] dismissed · simplify (altitude) · narrow the pairs query to one worker — measured 18 ms, and an outer filter does not narrow the CTEs
- [x] dismissed · simplify (altitude) · `triggerCount` polarity — reads as intended at the call sites
- [x] dismissed · reuse-scan · three „Nieprzypisane" labels — each is specified in plan / change / manual-checks for its surface
- [x] dismissed · reuse-scan · `getUserDefaultCashRegisterId` — `ReferenceDataBaseT` carries no `currentUserId`
- [x] dismissed · reuse-scan · `FormFooter` (would leak `showKeepOpen`), `FormShell`, error-p / spinner, em-dash span, `BlockedReason` vs `HintedValue`, `EmptyRow`, `DecimalInput` — shapes differ from the candidates
- [x] dismissed · simplify · `SettlePayoutsResultT` export nit; efficiency agent's checked-and-clean items

## Simplify pass

Ran /simplify (4 agents) + primitive-reuse-scan — 11 applied, 1 filed (EX-936), 1 skipped, 4 dropped, 6 dismissed;
each finding folded into ## Findings (tagged `simplify` / `reuse-scan`). Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.7je9g0WrgE.md`

## Tests & suite

- `tsc --noEmit` clean; prettier + eslint on all touched files clean.
- 19 touched spec files, 194/194 — unit + DOM (`worker-payout-pairs`, `users`, `settle-payouts-form`,
  `fleet-data-table`, `use-totals-panel-open`, `sidebar`, `sum-transfers`, `investment-gate`) and DB on 5435
  (`settle-payouts`, `lib/db/worker-payout-pairs`, `equipment`, `presets`, `snapshots`,
  `kosztorys-catalogue-apply`, `display-order`, `insert-kosztorys-tree`, `work-catalogue`, `kosztorys-presets`,
  `register-balance-net-expense`).
- Full suite: skipped by the user (pre-push runs it).
