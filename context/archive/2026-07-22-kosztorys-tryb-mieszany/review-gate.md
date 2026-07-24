# Review-gate ledger — kosztorys-zaliczka-v2 + tryb-mieszany · 2026-07-22

Scope: whole change on `konradantonik/ex-536-zaliczka-v2` vs `origin/staging` (26 commits,
69 files, +2544/−1011). Two slices: **zaliczka-netto-brutto** (vatPlane flag, paymentMethod
companion, wpłaty list, migrations) + **tryb-mieszany** (materiały-brutto waterfall, cash
settlement, rabat segment, deposits reconciliation). Do NOT push. Do NOT archive (review only).

Fan-out: code-review · impl-review(tryb-mieszany) · impl-review(zaliczka) · doc-reconciliation ·
structure-trio · tailwind-v4 · comment-noise. All seven returned. **No 🔴 CRITICAL; math verified
consistent** (at C=0 `settlement.total === doZaplaty.gross`; the two reconciliation tables can't
drift — same `DEPOSIT_TYPES` filter). Dominant theme is exactly what the user flagged: **docs
diverged from owner-changed decisions**, plus dead code left by the redesign.

## Findings

<!-- ONE checkbox per finding. [box] [severity, bug-checks only] · disposition · `source` · `file:line` · what — reason -->

### Open — need a call (user / owner) before they can close

- [x] skipped · `code-review`+`impl-review(tm)`+`comment-noise`+`doc-recon` · `kosztorys-summary.tsx:152-155` · commented-out pies + `sectionSubtotals`/`SectionSliceInputT` plumbing. **Keep parked — owner ruling:** line 152 `DO NOT REMOVE TODO WILL BE BACK!` marks these as deliberately parked, not redesign residue. ESLint clean, no CI risk. Not a finding.
- [x] 🔵 fixed · `code-review`+`impl-review(z)`+`owner` · `sum-transfers.ts:262` · COMPANY_FUNDING could land in the client wpłaty surface as a brutto deposit. **Closed at the read boundary once and for all:** narrowed `getDepositTransactionsForInvestment` from `type IN (DEPOSIT_TYPES)` → `type = 'INVESTOR_DEPOSIT'`, with a comment stating the ruling (company funding ≠ client payment; the form already hides its investment picker, so this shuts the only remaining admin-panel path). Zero such rows exist in DB; typecheck clean. This query feeds ONLY the client Podsumowanie (list + „Rozliczenie wpłat" + mixed-settlement gotówka target) — no other caller. Stop re-flagging.
- [x] dismissed · `impl-review(z)` · `context/changes/` · vatPlane/deposit-persistence slice has no own change folder. **Moot — not archiving** (owner, 2026-07-23): new changes landed after this review and a larger concept rework is incoming, so the slice stays open. No archive gate to satisfy; the `tryb-mieszany` folder + this ledger + glossary/domain-notes document the shipped state for now.

### Fix now (confident)

- [x] 🟡 WARNING · fixed · `code-review`+`impl-review(z)` · `constants/transfers.ts:136` · false "null never selectable / form forces one of these two" comment → rewritten to "optional third state, null default, read as **netto**" (re-flipped 2026-07-23 after commit `768e0d50` changed the default plane from brutto→netto).
- [x] 🟡 WARNING · fixed · `code-review`+`impl-review(z)` · `collections/transfers.ts:121` · false "create-schema rule enforces it" comment → rewritten to reflect the `.optional()` design (null is the deliberate default).
- [x] fixed · `tailwind-v4` · `kosztorys-totals-panel.tsx:136` · registered `--shadow-panel` (`rgb(0 0 0 / 0.2)`) in globals.css `@theme`, class → `shadow-panel`.
- [x] fixed · `comment-noise` · `summary-grid.tsx:57` · trimmed `SummaryHeaderCell` comment to the track-role sentence.
- [x] fixed · `impl-review(tm)` · `summary-breakdown-table.tsx:4-14` · moved imports above the `MATERIALY_HINT` const.
- [x] fixed · `impl-review(tm)` · `cash-settlement.tsx:85` · dropped trailing space in `"Reszta netto"`.
- [x] fixed · `tailwind-v4` · `kosztorys-stage-totals.tsx:47-48` · removed `labelCell`/`valueCell` aliases; use `SUMMARY_LABEL_CELL`/`SUMMARY_VALUE_CELL` directly.

### Dead code from the redesign (commented-out — user-parked?)

- [x] dismissed · `impl-review(tm)`+`comment-noise`+`code-review` · `cash-settlement.tsx` · **stale finding** — no commented-out rows exist (file is 67 lines, cited `:97-109` isn't there); the waterfall renders clean and `settlement.cash` is used. Nothing to remove.

### Doc reconciliation (the stale-docs sweep you asked for)

- [x] fixed · `doc-recon` · `02-glossary.md:112` · `stage` row drift cell cleared ("— (rename landed EX-536)"); dropped the "drift left to rename" prose.
- [x] fixed · `doc-recon` · `02-glossary.md:113` · removed the `stage deposit` (`zaliczki`) row — concept gone.
- [x] fixed · `doc-recon` · `02-glossary.md:121-131` · rewrote the "`zaliczki` worst offender" paragraph → "retired (EX-536)".
- [x] fixed · `doc-recon` · `02-glossary.md` · added Cat-B rows for the new identifiers (deposit VAT plane, payment method, cash settlement, deposits split, deposit row).
- [x] fixed · `doc-recon` · `kosztorys-editor-domain-notes.md:310-315` · "mechanika … do rozstrzygnięcia" rewritten → "ROZSTRZYGNIĘTA (EX-536)" with vatPlane details.
- [x] fixed · `doc-recon` · `tryb-mieszany/plan.md:89-102` · rewrote the `computeCashSettlement` contract to the shipped 4-arg/6-field `combinedNet`-anchored signature.
- [x] fixed · `doc-recon` · `tryb-mieszany/plan.md:44-54` · corrected the end-state block to the six-row waterfall.
- [x] fixed · `doc-recon` · `tryb-mieszany/plan.md` · added the ⚠️ reconciled banner (3 shipped-differently deltas); test-home path → `summary-economics.test.ts` (replace_all).
- [x] fixed · `doc-recon` · `tryb-mieszany/change.md:26-34` · "4 blockers before planning" → "4 blockers — all resolved in the shipped implementation" with resolutions.
- [x] fixed · `doc-recon` · `tryb-mieszany/change.md:35-36` · removed the malformed trailing `</content>`/`</invoke>` tags.
- [x] fixed · `doc-recon` · `manual-checks.md:709` · added a "> **RETIRED (EX-536):**" banner flagging Phase 4/Phase 5/finding as a deleted feature.
- [x] fixed · `doc-recon` · `manual-checks.md:714` · covered by the same RETIRED banner (NO_STAGE sentinel gone).
- [x] fixed · `doc-recon` · `lessons.md:189-190` · added a "**Note (EX-536)**" line — generalization kept, concrete anchors removed.
- [x] fixed · `doc-recon` · `roadmap.md:464,468,471` · EX-536 Q1 restated (deposit vatPlane shipped, presentation-only); S-11 "Update (EX-536)" note added.
- [x] skipped · `doc-recon` · `kosztorys-editor-domain-notes.md:333-340` · "RABAT znika / nie ma Σ RABAT" — NOT in this branch's scope (EX-535, unshipped); leave as "planned". Correct-as-planned, not stale against this branch.
- [x] dropped · `doc-recon` · `investment-financials-and-discount.md:57` · optional "vatPlane is presentation-only / not in P&L" note. Nice-to-have; not worth the churn now.

### Naming-rule drift (AGENTS.md rules 3/4)

- [x] skipped · `doc-recon` · `summary-economics.ts`/`cash-settlement.tsx` · new code propagates `wplatyNet` (banned Polish-root+English-affix, canonical `depositsNet`). Pre-existing drift widened, not introduced; converging it is a cross-cutting rename beyond this review. Glossary already tracks it as open drift — no new doc-lie. Flag only.

### Tests owed (expanded per user: "proper unit tests in the summaries with new reality covered")

- [x] test · fixed · `impl-review(tm)`+`code-review`+`user` · `summary-economics.test.ts` · summary reality now unit-covered (15 → 29 tests, all green): `moneyPair`/`faceValue` VAT direction + inverse, `summaryLine`/`summaryLineFace`/`summaryLineGross` udział builders (incl. zero-Łącznie), `bucketDepositsByPlane` (NET/GROSS/**null⇒netto** after the 2026-07-23 flip/empty), `depositsSplit` (per-plane netting + overpaid negative), and the **reconciliation invariant** `remainingNet + remainingGross === settlement.total`. Enabling refactor: extracted the inline bucketing from `deposits-reconciliation.tsx` into pure `bucketDepositsByPlane` so the owner ruling is testable. Typecheck clean. (Commit `768e0d50` later flipped the default plane brutto→netto and updated these tests.)

### Dismissed / dropped (verified benign)

- [x] dismissed · `code-review` · `page.tsx`/`client-kosztorys.ts` · materiały netto→brutto reinterpretation on real expense data — intended, owner-confirmed slice-A decision (materiały brutto-native, AGENTS.md).
- [x] dismissed · `code-review` · `subcontractor-summary.tsx` · payout sign flip `formatNet(-x)`→`formatNet(x)` — intentional (green consistency); `summary.remaining` math untouched.
- [x] dismissed · `code-review` · cash mode shows settlement „Razem" + `DepositsReconciliation` together — verified same grand total; deliberate design. Presentation only.
- [x] dismissed · `structure` · `collapsible-panel-trigger.tsx` vs `collapsible-section.tsx` coexist — different state-ownership; justified.
- [x] dropped · `code-review` · `grossPair` single `tree.vatRate` for materiały netto — unstated single-rate invariant; domain guarantees one rate/kosztorys. Too speculative to fix.
- [x] dropped · `code-review`+`impl-review(z)` · no hook clears a stray `vatPlane` on non-deposit types — read path is `WHERE type IN (deposit types)`, so unreadable. Not worth the churn.
- [x] dropped · `structure` · `summary-economics.ts` 3-altitude stacking (VAT primitives + builders + waterfall) — cohesive today; optional future split into `calc.ts`. Over-engineering now.

## Status (2026-07-23)

Review triage complete — **0 open boxes**. All fix-now/doc-recon applied; the two dead-code items
were owner-parked/stale; COMPANY_FUNDING closed at the read boundary; the change-folder item is moot.
**NOT archiving** — new changes landed post-review and a larger concept rework is incoming, so the
slice stays open and `/simplify` + the full suite are deferred until that rework is shaped.

## Simplify pass

_(deferred — not running to archive; slice reopened for a concept rework)_

## Tests & suite

- summary-economics.test.ts — 29 passed (was 15; +14 new covering the summary/reconciliation reality). ✅
- `pnpm typecheck` — clean (guards the `bucketDepositsByPlane` extraction + cross-module import). ✅
- Full suite (lint/test/build/e2e) — deferred until the open findings are triaged and you give the go.
