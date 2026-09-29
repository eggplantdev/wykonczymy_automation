# Review-gate ledger — investment-wycena-status · 2026-09-29

Scope: commits `1af4174f`, `c56b9f16`, `458186d6`, `d2de3a31` against base `7f4f1933` (staging; the
range also holds other sessions' commits, which are out of scope). Step 0.5 (browser verification
pass) skipped — the manual checks stay with a human in `context/foundation/manual-checks.md`.

## Findings

- [x] 🟡 WARNING · dismissed · code-review · `src/hooks/use-status-filter.ts:14` · a saved „Aktywna only" map hides a freshly added Wycena (toast, no row) — the filter hides what that user asked to hide: the same user choosing „Aktywna only" after the deploy gets the identical result with no inheritance involved, so the rule isn't the cause. Inheritance from Planowana is an owner decision; surfaced to the owner alongside F2 rather than changed
- [x] 🔵 OBSERVATION · dropped · code-review · `src/components/forms/investment-form/investment-schema.ts:15` · a forged `createInvestmentAction` call with `status:'szablon'` creates a szablon outside `createTemplate` — pre-existing, unreachable from the UI, name clash still blocked by the unique index (reachability rule)
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/queries/reference-data.ts:156` · no cache-key bump needed — the union only widened, an old cached entry is still valid
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/tables/investments.tsx:295` · Status column sorts alphabetically, not by lifecycle — pre-existing, unchanged by this slice
- [x] dropped · feature-first-structure + structure-scatter-audit · `src/lib/constants/` vs `src/lib/<domain>/` · status enums live in two homes — pre-existing; this slice joined an existing home beside `investment-lock.ts`, created none
- [x] dropped · module-cohesion-audit · `src/lib/constants/investment-lock.ts:28` · `TEMPLATE_INVESTMENT_STATUS` is more on-topic in `investment-status.ts` — 8 importers of churn for no behaviour
- [x] dismissed · tailwind-v4-audit · — · no findings (amber badge uses stock palette utilities)

_Trimmed at archive (2026-09-29): the 14 `fixed` findings were removed — their record is commit
`0308e634`; what stays is what git cannot hold. Pre-trim tally: 14 fixed, 4 dismissed, 3 dropped,
0 open._

## Simplify pass

Ran in the main thread, not as a separate `/simplify` agent — the fan-out had already named every
cleanup on a ~12-file diff, so a second review pass would re-find them: 14 applied, 0 proposed,
0 further dismissed; each folded into ## Findings above. One accidental reformat of another session's
`trash-investment-button.tsx` (prettier glob) was reverted, not committed.

## Tests & suite

- `npx tsc --noEmit` — clean
- `eslint` on the touched files — clean
- `src/__tests__/use-status-filter.test.ts` — 15/15
- `src/__tests__/collections/investments-status.db.test.ts` on 5435 — 5/5
- Full suite / build — not run in this gate (see close-out)
- E2E — not run (never unprompted); `e2e/investment-planowana-status.spec.ts` only had its labels import repointed, typechecked
