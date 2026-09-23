# Review-gate ledger — catalogue-picker-new-section (+ investment-gate rename) · 2026-09-22

The working tree holds **two independent units** and the user asked for a review of all of it:

- **Unit A — `catalogue-picker-new-section`** (this change folder): „Dodaj do:" accepts a new sekcja
  name; sekcja + prace written in one transaction.
- **Unit B — `investment-lock` → `investment-gate` rename** (EX-846, uncommitted in the tree):
  `src/lib/db/investment-gate.ts`, `src/lib/db/lock-investment-for-replace.ts`, the new
  `src/lib/actions/provision-workshop.ts`, and ~14 call-site edits.

Unit B has no `plan.md`, so `/10x-impl-review` covers A only; every other check is whole-tree.

## Findings

_Przycięte przy archiwizacji (2026-09-23): wypadło 22 pozycji `fixed`. Trwałym zapisem naprawy jest jej commit; tu zostaje negatyw, którego git nie trzyma — to, czego świadomie **nie** zrobiono i dlaczego. Bilans sprzed przycięcia: 22 fixed, 7 dismissed, 2 dropped, 1 skipped · 0 otwartych._

<!-- Format: [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason
     Sources: impl-review | code-review | tailwind-v4 | feature-first | module-cohesion |
              structure-scatter | comment-noise | primitive-reuse | simplify | self -->

### Unit A

- [x] skipped · module-cohesion · `src/lib/actions/work-catalogue.ts` · 430 LOC / 9 actions / 3 reasons to change. Real, but a 9-action split is a review-worthy refactor of a file this slice only touched in two places — its own change, not a rider on this one.

### Dismissed / dropped at triage

- [x] dismissed · tailwind-v4 · `add-items-from-catalogue-dialog.tsx:230` · `z-[10001]` — pre-existing line, untouched by this diff; promotion would edit `ui/select.tsx` / `form-date-picker.tsx` outside the slice.
- [x] dismissed · tailwind-v4 · `add-items-from-catalogue-dialog.tsx:263` · `max-h-[55vh]` — same: pre-existing, recurs 3× repo-wide, promotion needs a `cn.ts` classGroups entry.
- [x] dismissed · feature-first · every new/moved file landed in the right home, `provision-workshop.ts` included — the move is what buys it the `server-only` that `workshop-investment.ts` cannot have.
- [x] dismissed · structure-scatter · 0 competing directories, 0 stray files, 0 new homes.
- [x] 🔵 OBSERVATION · dropped · code-review · `add-items-from-catalogue-dialog.tsx:106` · a sekcja renamed to whitespace-only drops out of `sectionNameOptions`, so „Dodaj" stays disabled with the right sekcja targeted. Reachability first: nobody names a sekcja three spaces, and the grid's inline rename has always allowed it. Not worth the churn.
- [x] 🔵 OBSERVATION · dismissed · code-review · `work-catalogue-insert.test.ts:97` · the new DB spec leaves the shared fixture investment's sekcje at `display_order + 1`. Benign: a uniform +1 preserves relative order and no spec asserts an absolute `display_order` other than the `0` this spec creates.
- [x] dropped · comment-noise · `work-catalogue.ts:150` · the security comment now heads the private `readCatalogueItems` helper rather than the exported actions — placement only, still load-bearing where it sits.
- [x] dismissed · primitive-reuse · `add-items-from-catalogue-dialog.tsx` · no reinvention: the dialog composes `Combobox`, `DataTable`, `FilterMultiSelect`, `SearchFilterInput`, `Dialog`, `Checkbox`, plus `useSearchFilter` / `useClientMultiFilter`. Nothing hand-rolled, no new `ui/` candidate.
- [x] dismissed · primitive-reuse · `create-section-with-catalogue-items.ts` / `place-catalogue-items.ts` · the server helpers reuse `shiftDisplayOrderFrom`, `sectionOwnerAndNextItemOrder`, `insertItems`, `checkSubcontractorPrice` and `getDb` rather than re-deriving display-order arithmetic, the insert, the price guard or a connection.

## Simplify pass

Fix-first was applied during triage: every finding above that earned a fix was applied directly in
Step 2 rather than being handed to a second mutating pass — 20 fixed, 1 skipped (a review-worthy
refactor), 7 dismissed, 2 dropped, **0 open**.
No separate `/simplify` report was produced; this ledger is the single record, per the gate's
one-list rule.

## Tests & suite

- `pnpm exec tsc --noEmit` — clean.
- `pnpm exec vitest run src/__tests__/lib/kosztorys/row-ops.test.ts` — 14 passed (3 new).
- `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/section-target.test.ts src/__tests__/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.test.tsx` — 12 passed.
- DB leg (`work-catalogue-insert.test.ts`, incl. the 2 new cases) — **not run**: it needs the 5435
  `db-test` container and is part of the full suite, which waits for the user's go.
- Full suite (`typecheck && lint && test && build`) — **pending the user's go** (machine-wide test lock).
- E2E — none authored, none owed: nothing here crosses client → server action → DB → revalidation
  in a way the new DOM spec and the DB spec don't already cover.
- `pnpm exec vitest run src/__tests__/lib/db/investment-gate.test.ts src/__tests__/lib/actions/investment-action.test.ts` — 21 passed (unit B, after the symbol renames).
