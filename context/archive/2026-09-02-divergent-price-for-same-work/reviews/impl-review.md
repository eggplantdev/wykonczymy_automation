<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: „Problemy": ta sama praca wyceniona różnie (EX-761)

- **Plan**: context/changes/2026-09-02-divergent-price-for-same-work/plan.md
- **Scope**: Phase 1 + Phase 2 (all phases; `5f08a608~1..HEAD`, 3 commits)
- **Date**: 2026-09-02
- **Verdict**: APPROVED
- **Findings**: 0 critical · 2 warnings · 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

## Automated verification

| Command                                                                     | Result                                                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm exec vitest run src/__tests__/lib/kosztorys/price-divergence.test.ts` | PASS — 7 tests                                                                                               |
| `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts`   | PASS — 65 tests                                                                                              |
| `pnpm exec vitest run src/__tests__/lib/kosztorys/row-view.test.ts`         | PASS — 7 tests                                                                                               |
| `pnpm typecheck`                                                            | PASS — clean                                                                                                 |
| `pnpm lint`                                                                 | FAIL (exit 1) — 4 errors, all pre-existing in `test.js` + migrations; **zero** in the touched files (see F6) |

Manual verification: EX-761's four boxes were correctly registered in `context/foundation/manual-checks.md` and left `- [ ]` (pending). No rubber-stamping in this change's own section.

## Plan-vs-diff file map

| File                                                      | Verdict                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/lib/kosztorys/price-divergence.ts`                   | MATCH — exact contract `divergentPriceRowIds(rows): Set<number>`                                              |
| `src/__tests__/lib/kosztorys/price-divergence.test.ts`    | MATCH — all seven planned cases present, one `it` each                                                        |
| `src/lib/kosztorys/row-conditions.ts`                     | MATCH — id/label/tone/`sectionLabel: null`/`revealsColumns: ['price']`/no `problemLabel`, verbatim as planned |
| `src/components/kosztorys/editor/use-kosztorys-editor.ts` | MATCH — one memo, four ctx literals + four dep arrays                                                         |
| `src/lib/kosztorys/row-view.ts`                           | MATCH — field in `input` type and in the ctx literal                                                          |
| 5 existing spec files                                     | MATCH — mechanical `divergentPriceRowIds: new Set()`                                                          |
| `context/foundation/manual-checks.md`                     | EXTRA (partly) — see F1                                                                                       |

No planned item MISSING. No unplanned source file touched.

## Findings

### F1 — Epilogue commit ticks five manual checks belonging to a different change (EX-766)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `context/foundation/manual-checks.md:3679-3705` (commit `0cbb0240`)
- **Detail**: `0cbb0240 chore(divergent-price-for-same-work): close out plan (epilogue)` is the commit that adds EX-761's four (unticked) manual checks — but the same hunk also flips five EX-766 boxes from `- [ ]` to `- [x]` and prepends an evidence paragraph about investment 66 „Altowa 12". EX-766 is the previous, already-closed change (`384bbd62`). The verification narrative is detailed and plausible, but nothing in _this_ diff substantiates it, and it rides in under EX-761's change-id. Two of those boxes were explicitly ticked by a substitute route (unit tests + Local API instead of `/admin` and a sheet import) — a judgement that belongs in EX-766's own record, not smuggled into another change's epilogue.
- **Fix**: Leave the ticks (the work was evidently done) but note in EX-761's `change.md` that `0cbb0240` also closed EX-766's manual pass — or, cleaner going forward, land another change's checkbox ticks in their own commit so the ledger's provenance stays readable.
- **Decision**: PENDING

### F2 — `review-gate.md` is untracked and its three ledger sections are empty

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/changes/2026-09-02-divergent-price-for-same-work/review-gate.md`
- **Detail**: The file declares scope and lists four gates skipped with reasons (all four reasons are sound for a 39-line single-export module), but `## Findings`, `## Simplify pass` and `## Tests & suite` are all empty headers, and the file is not in any of the three commits (`git status` → `?? review-gate.md`). Meanwhile `change.md` already says `status: implemented`. So the gate ledger currently asserts nothing about whether a simplify pass or the suite ever ran, and it will not survive a `git clean`.
- **Fix**: Fill the three sections (even with „brak findingów" / the suite command + result) and commit the file with the change folder.
- **Decision**: PENDING

### F3 — The plan's „liczniki są rozłączne" premise is false of the existing registry

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `plan.md` § „Rozstrzygnięcia podjęte bez pytania" pt. 1; `src/lib/kosztorys/row-conditions.ts:268`
- **Detail**: The plan justifies excluding price-less pozycje with „Rejestr trzyma zasadę, że liczniki są rozłączne i żadna pozycja nie jest zgłaszana dwa razy". That invariant does not hold registry-wide and never did — `no-client-price-with-work` (`!(clientPrice>0) && qtyDone>0`) and `work-without-planned-qty` (`!(plannedQty>0) && qtyDone>0`) already both fire on a row with price 0, przedmiar 0 and executed work. The comment at `row-conditions.ts:268` scopes disjointness to the **cena j.m. family** only. **The implemented decision is still right** — `price-divergence.ts:23` skips `!(row.clientPrice > 0)`, which is exactly the seam that comment defends — it is the stated _reason_ that overclaims. Left uncorrected, a future change will cite the plan as evidence of a registry-wide rule and either enforce it or „fix" a non-bug. Note that `divergent-client-price` can legitimately co-fire with `measure-diverged`, `work-without-planned-qty` and the `material-percent-rate-*` pair, same as the pre-existing overlaps.
- **Fix**: Correct the wording when archiving — the rule is „the cena j.m. diagnostics stay disjoint", not „the registry does".
- **Decision**: PENDING

### F4 — The grouping memo runs under the client preview, where its result is discarded

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (performance)
- **Location**: `src/components/kosztorys/editor/use-kosztorys-editor.ts:399`
- **Detail**: `const divergingPriceIds = useMemo(() => divergentPriceRowIds(rows), [rows])` is unconditional. Under `preview` the value is never consulted: counts are zeroed at `:403`, `foldableSectionIds` short-circuits at `:530`, and `documentRows` runs `clientConditionIds`, which is a frozen allowlist containing only `'client-empty'`. So a client's share pays one full pass over up to ~1000 pozycje plus a `Map`/`Set` build for a set nothing reads. Every neighbouring memo in this file guards on `preview` first — this is the one that doesn't. The cost is a single O(rows) pass, so this is cheap-and-cosmetic, not a regression.
- **Fix**: `useMemo(() => (preview ? EMPTY : divergentPriceRowIds(rows)), [preview, rows])`, matching the `preview ? 0 : …` shape at `:403`.
- **Decision**: PENDING

### F5 — Three names for one concept: `divergentPriceRowIds` vs `divergingPriceIds`

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/components/kosztorys/editor/use-kosztorys-editor.ts:399`
- **Detail**: The function, the ctx field and the condition all read `divergentPriceRowIds`; the hook's local binding reads `divergingPriceIds`, and is then re-aliased back at four ctx literals (`divergentPriceRowIds: divergingPriceIds`). The rename exists only to avoid shadowing the imported function, which is a real constraint — but AGENTS.md's „one concept, one name" makes the alias worth naming deliberately rather than by accident, and the four re-alias sites are where a future reader loses the thread.
- **Fix**: Either import the function aliased (`import { divergentPriceRowIds as computeDivergentPriceRowIds }`) so the local keeps the canonical name and the four ctx literals become shorthand, or leave as-is and accept the alias. Not worth churn on its own.
- **Decision**: PENDING

### F6 — The plan's whole-tree lint gate cannot pass on this repo

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `plan.md` § „Whole-tree Gate"; `test.js:284`, `src/migrations/*.ts`
- **Detail**: `pnpm lint` exits 1 with 4 errors and 86 warnings — `'console' is not defined` in the repo-root `test.js` (a scratch file of sorting algorithms, unrelated to the app) plus unused `db` args in three migrations. All pre-existing; **not one** originates in the five files this change touched. The gate as written is therefore permanently red and gives no signal about any change — it can only ever be satisfied by reading past the failure.
- **Fix**: Either lint-ignore `test.js` and the migrations dir so the gate becomes meaningful, or write future plans' gate as „no new lint findings in the touched files".
- **Decision**: PENDING

## Notes

- Requested READ-ONLY, so `change.md` was **not** flipped to `status: impl_reviewed` — it still reads `implemented`.
- Verified independently: the new condition id needs no registration anywhere else. `PROBLEM_CONDITIONS` derives from `ROW_CONDITIONS.filter(kind === 'diagnostic')` (`problem-conditions.ts:19`), engaged-condition persistence (`use-engaged-conditions.ts`) is an arbitrary-key localStorage map with no enum/zod schema, and the client-view settings collection stores column keys only. No silent-omission risk.
- `revealsColumns: ['price']` is the exact client cena j.m. key (`kosztorys-v2-columns.tsx:310`), distinct from the `price__<plane>` keys, and the reveal never writes into the stored visibility map — so the column does return to the user's picker state on disengage, as the plan's manual check expects.
- `row.description?.trim()` at `price-divergence.ts:24` looks redundant against `foldDescription` (which trims) but is load-bearing on the **guard**: without it a whitespace-only opis passes `if (!description)` and `foldDescription('   ') === ''` would weld every blank-opis row into one group — the exact case the file's own comment says must be excluded.
- `!(row.clientPrice > 0)` (rather than `<= 0`) is NaN-safe and matches the registry's own idiom.
