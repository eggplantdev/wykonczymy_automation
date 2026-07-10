---
change_id: kosztorys-vat
title: VAT per investment — netto entry, brutto computed
status: implemented
created: 2026-07-10
updated: 2026-07-10
archived_at: null
---

## Notes

Roadmap slice S-05. Each investment carries one VAT rate (`investments.vat_rate`); prices are entered **netto** and brutto is computed. One rate per investment — no per-section/per-item rate, no cascade, no override. Prereq: S-01 (done). Downstream: robocizna netto/brutto derivation (client billing, 23% vs 8%) — confirmed **out of scope** (unbuilt today; future slice).

### Decisions (owner, 2026-07-10)

- **D1 — Rate edited in the kosztorys editor view** (not the investment edit form, not Payload admin). Needs a rate control in the editor toolbar (near the S-02 price-view toggle) that persists to `investments.vatRate` via a server action + recompute (`router.refresh` re-reads the tree). ⇒ `vatRate` does NOT need to reach `InvestmentRefT`/`reference-data.ts` (research open Q4 resolved: kosztorys query + write path only).
- **D2 — Default VAT = 8%.** `DEFAULT_VAT = 0.08` in `src/lib/kosztorys/constants.ts`; column default `0.08`.

### Recommended (pending, low-stakes)

- **Brutto column always-on read-only** (research Q3) — avoids the dsg remount-key trap; no toggle dimension.
- **Section summary gets a brutto counterpart** to "Suma netto" (research Q5) for parity — confirm at plan review.
