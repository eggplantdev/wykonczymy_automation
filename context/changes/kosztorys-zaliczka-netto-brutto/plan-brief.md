# Wpłata bucket flag + drop stage link + Do zapłaty netto/brutto — Plan Brief

> Full plan: `context/changes/kosztorys-zaliczka-netto-brutto/plan.md`
> Calc model + owner decisions: `context/changes/kosztorys-zaliczka-netto-brutto/design-bilans-vat-planes.md`
> Research: `context/changes/kosztorys-zaliczka-netto-brutto/research.md`

## What & Why

EX-536 (owner-confirmed 2026-07-21, revised after shaping): a wpłata carries a **netto/brutto bucket
flag** so the kosztorys Podsumowanie can show what the client owes **z VAT and bez VAT**. Crucially the
flag is a **classifier, not a converter** — no VAT is ever applied to a paid amount; VAT dolatuje tylko
do _reszty zobowiązania_. Along the way, drop the misleading deposit→etap „zaliczka" link.

## The confirmed calc model (owner: „dokładnie")

```
baseLeft          = robocizna − Σ(wpłaty netto)                       only a FLAGGED netto wpłata eats the net base, at face
Do zapłaty netto  = baseLeft − Σ(legacy)                             legacy subtracts at face (as the old code did)
Do zapłaty brutto = baseLeft × (1+vat) − Σ(wpłaty brutto) − Σ(legacy) brutto wpłata + legacy both at face on the gross axis
```

Worked: robota 2000, wpłata 1000 netto → Do zapłaty netto 1000, Do zapłaty brutto 1080. Legacy (`null`)
wpłaty **still reduce Do zapłaty**, but at **face on BOTH axes** — legacy is old data and must render
**identically to the pre-change code** (`toGross(R) − wplaty`). It is **not** in `baseLeft`, so it is never
grossed; only the flagged buckets drive the sequential model. Legacy-only R 2000, legacy 1000 → netto 1000,
brutto 2000×1,08 − 1000 = **1160** (both axes unchanged). No backfill. **No `toNet`, no per-wpłata conversion.**

## Starting Point

A transaction stores one immutable `amount`, no plane flag. The only VAT source (`investments.vatRate`,
default 0.08) is consumed solely by the kosztorys client-price plane. The Podsumowanie renders wpłaty as
one face-value figure (`faceValue(wplatyNet)`, fed by `totalIncome` = all deposit types). `MoneyAxisToggle`
(Netto/Brutto/Pokaż wszystko) hides money columns in two render paths (collapsed headline + expanded grid).
The stage link drives a per-etap „Wpłaty" row + a dead read chain (incl. the only cached deposit-read
wrapper). The deposit picker offers three types. `paymentMethod` exists but the forms hardcode `'CASH'`.

## Desired End State

The deposit picker offers only „Wpłata od inwestora"; creating one forces a netto/brutto choice stored as
`vatPlane: 'NET' | 'GROSS' | null`; the amount is never converted. The Podsumowanie shows **Wpłaty netto /
Wpłaty brutto** (bucket sums) and **Do zapłaty netto / Do zapłaty brutto** (sequential model) as one
locked, always-visible block, identical in the collapsed and expanded states (exempt from `MoneyAxisToggle`
in both). Legacy (`null`) wpłaty still reduce Do zapłaty at face on both axes (identical to the old code)
and show as an amber line. A wpłaty list itemises every deposit (date, amount, plane tag, link). The stage
link is gone end to end.

## Key Decisions Made

| Decision         | Choice                                                                                         | Why                                                                                                                                         | Source |
| ---------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Flag semantics   | **Bucket classifier, not converter**                                                           | Converting an already-paid amount ±VAT changes nothing; what matters is „ile powinien z/bez VAT"                                            | Design |
| Calc model       | Sequential: netto wpłata eats net base; brutto wpłata eats grossed remainder                   | Owner-confirmed („dokładnie"); zero conversion of any wpłata                                                                                | Design |
| `toNet`          | **Not added**                                                                                  | Only `toGross` on `baseLeft` is needed                                                                                                      | Plan   |
| Split direction  | **B** — split driven by tagged wpłaty; no „Policz bez VAT" target                              | „If it's needed we will add it" (Wariant A deferred)                                                                                        | Design |
| Flag column      | `vatPlane: 'NET' \| 'GROSS' \| null` (varchar+CHECK); required in the form                     | Three-state union so legacy `null` can't collapse into `'NET'`; form enforces the choice                                                    | Plan   |
| Flag scope       | `INVESTOR_DEPOSIT` only — **enforced at the picker** (`DEPOSIT_UI_TYPES` trimmed)              | Buckets/reducer see investor wpłaty by construction, no read filter; union teardown parked (EX-557)                                         | Owner  |
| Flag mutability  | Immutable (create-only), like `amount`                                                         | The flag is part of the row's money identity                                                                                                | Plan   |
| Legacy rows      | **Still reduce Do zapłaty** — at face on BOTH axes, NOT in `baseLeft`; amber line, no backfill | Legacy is old data; must render identically to the pre-change code (`toGross(R)−wpłaty`); „exclude" and „fold into net base" both corrected | Owner  |
| Toggle exemption | Four figures = one locked set, own always-visible block, both render paths                     | Netto+brutto shown as a pair so a single number can't mislead; „in sync" = one source                                                       | Owner  |
| `paymentMethod`  | Separate issue, first; trim to gotówka/przelew                                                 | Orthogonal to VAT (gotówka może być z VAT lub bez)                                                                                          | Design |

## Scope

**In scope:** companion `paymentMethod` restore (gotówka/przelew, separate issue); drop `kosztorysStage`
end to end; trim `DEPOSIT_UI_TYPES` to INVESTOR_DEPOSIT; add `vatPlane` (`'NET'|'GROSS'|null`,
INVESTOR_DEPOSIT, create-only); bucket sums (`sumNet`/`sumGross`/`legacySum`, legacy subtracted at face both
axes); `computeDoZaplatyRM` sequential model; four figures as one always-visible block; re-cache the deposit
read; new wpłaty list.

**Out of scope:** investment-view / balance / `financial-stats` (unchanged, raw amount); „Policz bez VAT"
obligation target (Wariant A); materiały netto/brutto (`÷(1+vat)`); per-etap VAT coeff; `toNet`; legacy
backfill; cash+invoice single-wpłata split; the `COMPANY_FUNDING`/`OTHER_DEPOSIT` union teardown (EX-557);
the `kosztorys_stages` table itself.

## Phases at a Glance

| Phase                       | What it delivers                                                                           | Key risk                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Companion                   | `paymentMethod` picker + column, trimmed to two                                            | Existing rows with BLIK/CARD                                                |
| 1. Stage-link teardown      | `kosztorysStage` removed everywhere; per-etap row + tests deleted; cached read deleted     | Collides with uncommitted `kosztorys-totals-panel.tsx` edits                |
| 2. Plane flag + picker trim | `vatPlane` storage + required form choice; `DEPOSIT_UI_TYPES` → investor-only              | `null` must never collapse into `'NET'`                                     |
| 3. Sequential model         | bucket sums (legacy at face both axes), `computeDoZaplatyRM`, four-figure block + re-cache | Toggle-exemption in BOTH render paths; reword stale waterfall-foots comment |
| 4. Wpłaty list              | Itemised list with plane tags + links; legacy amber                                        | Colour legibility; client-view text gate                                    |

**Prerequisites:** branch's local `kosztorys-summary.tsx` + `kosztorys-totals-panel.tsx` edits reconciled
by hand where wpłaty/stage props change. **Estimated effort:** ~2–3 sessions across 4 phases + the companion.

## Open Risks & Assumptions

- Under B, `Do zapłaty netto` **overstates** the true net remainder in mixed settlements (it ignores
  brutto wpłaty, since counting them would require the rejected conversion). Accepted tradeoff.
- Investment-view balance keeps raw amount — a book-side rozjazd for brutto wpłaty, accepted.
- Two prod migrations owed at ship time (human-applied), not during this local task.

## Success Criteria (Summary)

- A wpłata is created netto or brutto; Podsumowanie shows the four figures and nets Do zapłaty per the
  sequential model (owner example: 2000 / 1000 netto → 1000 / 1080).
- Legacy deposits show in the amber line (not the netto/brutto buckets) but **still reduce Do zapłaty**
  at face on both axes — netto AND brutto match the pre-change values (owner example: R 2000, legacy 1000
  → netto 1000, brutto 1160).
- `MoneyAxisToggle` never hides the four figures.
- No `kosztorysStage` / user-facing „zaliczka" remains; the wpłaty list itemises every deposit.
