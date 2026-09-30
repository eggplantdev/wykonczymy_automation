# Review-gate ledger — settle-payouts-pool · 2026-09-30

Scope: uncommitted working tree on `staging`, base `HEAD` — `settle-payouts-form.tsx`,
`settle-payouts-table.tsx`, `settle-payouts-form.test.tsx`; the simplify pass added
`lib/queries/settle-payouts.ts`, `hooks/use-register-balance.ts`, `dialogs/settle-payouts-dialog.tsx`.
Step 0.5 (browser verification) skipped: it drives the Playwright browser, which runs only on
request; manual checks live in the registry. Fan-out: one bug-finding agent (impl-review +
code-review), one structural agent (tailwind, feature-first, cohesion, scatter, comment-noise).

## Findings

- [x] 🟡 WARNING · fixed · code-review · `settle-payouts-form.tsx:75` · `eslint-disable react-hooks/exhaustive-deps` made the React Compiler skip the whole component — first `useEffectEvent`, then the effect removed entirely (simplify: saldo comes with the rows)
      test: no automated test — a compiler bailout is not observable in a DOM spec; lint + the absent suppression are the guard
- [x] 🔵 OBSERVATION · fixed · code-review · `settle-payouts-form.tsx:138` · „Aktualne saldo" not re-read after a stale refusal, though other payouts just moved the register — `fetchRegisterBalance` beside `setRows(fresh)`
      test: test-driven-debugging · unit (dom) — „re-reads the saldo after a stale refusal" was red, now green
- [x] 🔵 OBSERVATION · fixed · code-review · `settle-payouts-form.test.tsx:47` · mount fetch leaked 8 `act()` warnings into sync tests — saldo now seeded by prop; re-read mock pending by default
      test: no automated test — spec hygiene; the run output is the check (0 warnings)
- [x] 🔵 OBSERVATION · fixed · impl-review · spec · no spec that the kwota survives a stale reload (the plan's reason for `pool` being a form field) — added
      test: TDD · unit (dom) — „keeps the kwota through a stale-figures reload"
- [x] 🔵 OBSERVATION · fixed · impl-review · spec · no spec that saldo < Razem never blocks — added
      test: TDD · unit (dom) — „lets the payout go through even when it takes the register below zero"
- [x] 🔵 OBSERVATION · dismissed · code-review · `settle-payouts-form.tsx:184` · „unreadable branch unreachable behind `type="number"`" — false positive: `FormInput` renders `type="number"` as a text input with `inputMode="decimal"` and swaps comma for dot, so „1e" reaches `parseDecimalInput` as invalid
      test: no automated test — nothing to fix; the existing „1e" case exercises the branch
- [x] 🔵 OBSERVATION · dismissed · code-review · `settle-payouts-form.tsx:151` · negative kwota blocks with „Przekroczono…" — a typo that blocks visibly is the safer feedback; silently ignoring it would hide the typo
      test: no automated test — no change
- [x] 🔵 OBSERVATION · dropped · code-review · spec `:284` · „kwota not sent" test near-tautological — the manual check covers the opis leak; strengthening it asserts an empty string
      test: no automated test — no change
- [x] 🔵 OBSERVATION · dismissed · impl-review · `plan.md` · contract says `null ⇔ field empty`, code also nulls garbage — intended behaviour, spec names it; the plan is the historical record
- [x] 🔵 OBSERVATION · dismissed · impl-review · `manual-checks.md:2650` · this slice's registry hunk sits in a file with a parallel session's edits — commit it by hunk when committing; nothing to change now
- [x] fixed · module-cohesion · `settle-payouts-table.tsx:227` · remainder colouring duplicated `AfterPayoutCell` — `RemainderAmount` used by both
- [x] fixed · reuse-check · `settle-payouts-form.tsx:175` · redundant `roundToCents` (`signedMoneyColor` and `formatPLN` round) — dropped
- [x] dismissed · structure-scatter · `settle-payouts-form.tsx:173` · „Saldo po wypłacie" vs „Saldo po transakcji" elsewhere — dialog-specific wording the owner approved from the spike
- [x] dismissed · tailwind · `settle-payouts-form.tsx:164` · header row cramped at phone width — dialog outside phone scope (EX-785)
- [x] fixed · simplify · `settle-payouts-form.tsx:72` · mount effect → default saldo returned by `fetchSettlePayoutRows`, seeds `useRegisterBalance(initialBalance)` — no effect, no second round trip, other forms unchanged
- [x] fixed · simplify · `settle-payouts-form.test.tsx:217,238` · hand-built stale mocks → `staleRefusal()`
- [x] fixed · simplify · `settle-payouts-form.test.tsx` · clear+type pairs → `retype()`
- [x] dismissed · simplify · `settle-payouts-form.tsx:173` · reuse `RegisterBalanceSummary` — repeats „Aktualne saldo" + „Razem" already on screen
- [x] dropped · simplify · `settle-payouts-table.tsx:221` · second `ColumnTotalRow` repeats its props — two call sites, a wrapper costs more
- [x] skipped · simplify · `use-register-balance.ts` · saldo following the field value app-wide (expense / internal-transfer would show it on open) — behaviour change in other forms the plan scoped out; owner call

## Simplify pass

Ran /simplify (4 angles) — 3 applied, 0 proposed, 3 dismissed/dropped/skipped; each folded into

## Findings (tagged simplify). Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.c2VYVT1o72.md`

## Tests & suite

- No E2E owed: a client-side calculator + saldo display over an existing query; the DOM layer covers
  the risk (AGENTS.md: DOM first, Playwright only across client → action → DB).
- `pnpm exec vitest run` settle-payouts-form + use-register-balance specs — 25/25 green, 0 `act` warnings.
- `pnpm exec eslint` on touched files — clean. `tsc --noEmit` (whole tree) — clean.
- Full suite — deferred by user (pre-push runs the unit leg).

## Close-out

All 20 boxes checked · 0 open. Slice stays **in review**, not archived: the 4 manual checks in
`context/foundation/manual-checks.md` („Rozlicz wypłaty": kwota do rozdysponowania i saldo kasy) are unticked.
