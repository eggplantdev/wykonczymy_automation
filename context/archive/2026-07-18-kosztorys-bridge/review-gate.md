# Review-gate ledger — kosztorys-bridge · 2026-07-18

## Findings

<!-- ONE checkbox per finding; most-severe first. -->

### From Step 0.5 (verification pass)

### From Step 1 (review fan-out)

- [x] dismissed · impl-review · `src/components/kosztorys/kosztorys-v2-columns.tsx` · `markLayerBoundary` change flagged — NOT this slice; co-tenant's uncommitted work in the shared tree. Left untouched per the never-mutate-a-parallel-tree rule.
- [x] dismissed · code-review · pre-existing floating-promise / 404 patterns outside this diff — not introduced by the slice; out of scope.
- [x] dropped · comment-noise · two mild comment restatements in the Podsumowanie/EtapTotals additions — not worth the churn.
- [x] dismissed · impl-review · Robocizna base (F3) — **owner ruled Executed (current), 2026-07-18**: „Robocizna" stays on suma prac wykonanych (`T`-derived `doZaplatyNet`), and „Aktualnie do zapłaty (R + M)" nets `executed − zaliczki + Materiały`. No code change; netting semantics confirmed.

### From Step 2 (/simplify)

- [x] dropped · simplify · `kosztorys-editor-body.tsx` + `kosztorys-etap-totals.tsx` · Σ zaliczki reduced twice — trivial one-liner, not a helper reimplementation; deduping would worsen the etap-totals prop contract (it needs the map anyway). Not worth the churn.
- [x] dropped · simplify · `deposit-form.tsx:133,143` · two back-to-back `showsInvestment(currentType)` guards could nest — cosmetic, borderline.
- [x] dismissed · simplify · `transfers.ts:61` · bare `console.log('[PERF] …')` vs SENTRY marker — matches surrounding perf-log convention, intentional.
- [x] dismissed · simplify · `kosztorys-v2-columns.tsx` komentarz/`markLayerBoundary` — co-tenant's uncommitted work in the shared tree, not this slice.

### From primitive-reuse-scan (post-/simplify, pre-commit)

Catalogued the repo's primitive homes (`components/ui`, `hooks`, `lib/**`, `types`, feature `use-*`) and matched the diff's new symbols against it. **Clean** — this set is itself the `/simplify` output, so its new symbols are the reuse wins, not reinventions:

- [x] dismissed · reuse-scan · `money-axis.ts:14` · `axisShows` — no pre-existing net/gross-flag helper; this is the extraction the 3 summary components now share.
- [x] dismissed · reuse-scan · `summary-economics.ts:7` · `moneyPair` — no other net+gross pair builder in the catalogue; wraps `toGross`.
- [x] dismissed · reuse-scan · `sum-transfers.ts:15` · `depositTypesInList` — no shared deposit-type SQL fragment existed; derived from the single `DEPOSIT_TYPES` const.
- [x] dropped · reuse-scan · `kosztorys-etap-totals.tsx:38` + `kosztorys-podsumowanie.tsx:38` · two local `row` helpers — structurally distinct tables (per-etap columns vs fixed netto/brutto/udział); a forced shared primitive would be worse, not a dupe.
- [x] dropped · reuse-scan · `kosztorys-totals-bar.tsx` · repo has two parallel net-money formatters (`lib/kosztorys/format.ts › formatNet` vs `lib/utils/format-currency.ts › formatPLN`) — pre-existing; this diff introduced neither, so out of the scan's diff-scoped remit. Noted for a future consolidation pass, not filed here.

---

# Increment 2 — materiały per-category breakdown + „Wpłaty"/„Do zapłaty" · 2026-07-19

Scope: 7 uncommitted files (+107/−27) adding the v1-parity „Materiały" split
(budowlane / wykończeniowe / Pozostałe koszty + „Korekta (bez kategorii)" remainder)
and the unconditional „Wpłaty"/„Do zapłaty" rows. Fan-out: code-review, impl-review,
comment-noise, 3 file-org audits, tailwind-v4 — all read-only, diff-scoped.

## Findings (increment 2)

- [x] 🔵 OBSERVATION · dismissed · code-review · `map-category-costs.ts` · a `categoryCost` id absent from `expenseCategories` would drop from every visible row instead of the remainder. Benign: `fetchReferenceData` does an unfiltered `SELECT id,name FROM expense_categories` (all live ids present) and both sums exclude NULL-category rows in SQL. No soft-delete exists → not a reachable path.
      test: no automated test — defensive-only, no real trigger; would warrant one only if categories become soft-deletable.
- [x] dismissed · tailwind-v4 · `kosztorys-podsumowanie.tsx` · new rows reuse the pre-existing `row()` helper — zero new class strings, no arbitrary values. Clean.

## Simplify pass (increment 2)

Ran /simplify (reuse / simplification / efficiency / altitude lens) on the post-fix diff — 1 applied, 0 proposed, 1 dropped. Verified the four triage cleanups landed. Typecheck + 15 slice specs green.

- [x] dropped · simplify · `kosztorys-podsumowanie.tsx:94` · the `<Fragment>` around each `row()` `<tr>` exists only to carry the key — removing it means giving `row()` a key param, cosmetic churn against a correct stable key. Not worth it.

---

## Tests & suite (increment 2)

- Slice specs: `map-category-costs` (7, incl. 3 new `buildMaterialyBreakdown`) + `summary-economics` (8, updated for the trimmed `materialy` field) — 15 green.
- Fast legs (user opted, 2026-07-19): `pnpm typecheck` clean · eslint on all 10 changed files clean · full unit suite `pnpm exec vitest run` → **1053 passed, 40 skipped** (DB-integration/nodemailer-gated, pre-existing). Green.
- Heavy legs (`test:e2e`, `next build`) NOT run — deferred to pre-merge with increment 1's, same as before (slice parked in review pending owner sign-off).
- Browser E2E: the podsumowanie render (materiały split + „Wpłaty"/„Do zapłaty") folds into the slice's already-filed browser coverage **EX-531** (e2e-backlog); no separate new issue.

---

## Simplify pass

Ran /simplify (4 cleanup agents: reuse / simplification / efficiency / altitude) — 2 applied, 0 proposed, 4 dropped/dismissed; each folded into ## Findings above (tagged simplify). Typecheck + settlement/summary/zaliczki specs green.

## Tests & suite

- Unit specs (slice): summary-economics (8), zaliczki (4), kosztorys-settlement (4), transfer-schema (35) — green.
- Full unit suite: `pnpm exec vitest run` → 1048 passed, 40 skipped (DB-integration/nodemailer-gated, pre-existing). Green.
- `pnpm typecheck` → clean (after each fix + the /simplify cleanups).
- Browser E2E: **owed, filed to e2e-backlog as EX-531** (deposit→zaliczka flow incl. the SelectItem crash regression) — not authored inline; deferred per the review-gate E2E-backlog path.
- Heavy legs (`test:e2e`, `next build`) NOT run — deferred; slice is parked in review pending owner sign-off on netting semantics (F3). Run before merge to `main`.
