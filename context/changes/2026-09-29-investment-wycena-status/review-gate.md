# Review-gate ledger — investment-wycena-status · 2026-09-29

Scope: commits `1af4174f`, `c56b9f16`, `458186d6`, `d2de3a31` against base `7f4f1933` (staging; the
range also holds other sessions' commits, which are out of scope). Step 0.5 (browser verification
pass) skipped — the manual checks stay with a human in `context/foundation/manual-checks.md`.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `context/changes/2026-09-29-investment-wycena-status/plan.md:244` · Migration Notes claim a code rollback is safe because no row holds `quote` — false since every new investment is a `quote`; a rollback now needs `UPDATE … SET status='planowana' WHERE status='quote'` + `_4` down — rewritten: rollback owes the UPDATE + `_4` down
      test: no automated test — a deploy-runbook sentence, not code
- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/collections/investments-status.db.test.ts:47` · the „default is quote" case proves the collection `defaultValue`, not the column DEFAULT from `20260929_4`; Progress A.2 reads as if it covered the migration — A.2 kept (it is what the spec proves); Amendment now states the column DEFAULT has no automated test and was verified by psql
      test: no automated test for the column DEFAULT — nothing inserts an investment bypassing Payload (every raw INSERT names a status), and the value is verified by psql on 5433/5435 (`'quote'::enum_investments_status`); fix = reword A.2 honestly, not a raw-SQL spec for an unreachable path
- [x] 🟡 WARNING · dismissed · code-review · `src/hooks/use-status-filter.ts:14` · a saved „Aktywna only" map hides a freshly added Wycena (toast, no row) — the filter hides what that user asked to hide: the same user choosing „Aktywna only" after the deploy gets the identical result with no inheritance involved, so the rule isn't the cause. Inheritance from Planowana is an owner decision; surfaced to the owner alongside F2 rather than changed
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/changes/2026-09-29-investment-wycena-status/plan.md` (Amendment) · a new investment is hidden from the wpłata/wydatek pickers and „N aktywnych" until promoted to Aktywna — the Amendment records the default but not this effect; add it + a manual check — Amendment bullet + manual check „N aktywnych” added
      test: no automated test — consequence of an owner ruling, verified by the manual check
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/domain/02-glossary.md:254` · frozen-value pointer still names `src/types/reference-data.ts:15`, now `src/lib/constants/investment-status.ts` — repointed
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `e2e/investment-planowana-status.spec.ts:12` · comment says „default = active + planowana" — updated
- [x] 🔵 OBSERVATION · dropped · code-review · `src/components/forms/investment-form/investment-schema.ts:15` · a forged `createInvestmentAction` call with `status:'szablon'` creates a szablon outside `createTemplate` — pre-existing, unreachable from the UI, name clash still blocked by the unique index (reachability rule)
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/queries/reference-data.ts:156` · no cache-key bump needed — the union only widened, an old cached entry is still valid
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/tables/investments.tsx:295` · Status column sorts alphabetically, not by lifecycle — pre-existing, unchanged by this slice
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/changes/2026-09-29-investment-wycena-status/plan.md` Progress · A.1/A.2 lack the `— d2de3a31` suffix — suffixed
- [x] fixed · module-cohesion-audit + structure-scatter-audit + code-review · `src/components/investments/investment-status-badge.tsx:9` · `STATUS_LABELS` rebuilds `INVESTMENT_STATUS_LABELS[…].pl` with a cast and is a non-component export from a component file — read the constant directly (badge, `status-filter.tsx:54`, `investment-info-fields.tsx:28`, e2e spec) — removed; 4 call sites read `INVESTMENT_STATUS_LABELS[…].pl` like the vehicle/equipment badges
- [x] fixed · module-cohesion-audit + code-review · `src/hooks/use-status-filter.ts:10` · one tuple under three names (`PICKABLE_INVESTMENT_STATUSES` → `FILTERABLE_STATUSES` → `STATUS_ORDER`) — use the constant directly — both aliases removed
- [x] fixed · structure-scatter-audit · `src/types/reference-data.ts:16` · `InvestmentStatusT` has two import paths — repoint the importers at `@/lib/constants/investment-status`, drop the re-export — 4 importers repointed, re-export dropped
- [x] fixed · comment-noise-audit · `src/lib/constants/investment-status.ts:1` · trim „Written out by hand, not derived from the labels map:" — trimmed
- [x] fixed · comment-noise-audit · `src/migrations/20260929_3_add_quote_investment_status.ts:4` · trim the restated purpose, „Additive — no data migration" and the no-position-clause argument — trimmed
- [x] fixed · comment-noise-audit · `src/migrations/20260929_3_add_quote_investment_status.ts:15` · trim „Documented no-op." — trimmed
- [x] fixed · comment-noise-audit · `src/migrations/20260929_4_quote_is_the_default_status.ts:4` · trim „A new investment starts as a Wycena." — trimmed
- [x] fixed · comment-noise-audit · `src/hooks/use-status-filter.ts:9` · delete „Read by StatusFilter too…" (moot once the alias goes) — deleted
- [x] dropped · feature-first-structure + structure-scatter-audit · `src/lib/constants/` vs `src/lib/<domain>/` · status enums live in two homes — pre-existing; this slice joined an existing home beside `investment-lock.ts`, created none
- [x] dropped · module-cohesion-audit · `src/lib/constants/investment-lock.ts:28` · `TEMPLATE_INVESTMENT_STATUS` is more on-topic in `investment-status.ts` — 8 importers of churn for no behaviour
- [x] dismissed · tailwind-v4-audit · — · no findings (amber badge uses stock palette utilities)

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
