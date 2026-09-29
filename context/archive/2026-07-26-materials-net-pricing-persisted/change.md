---
change_id: materials-net-pricing-persisted
title: Give marża a materiały term — persist the netto reduction per investment and fix the settled-material VAT
status: archived
created: 2026-07-26
updated: 2026-07-27
archived_at: 2026-07-27T17:18:46Z
branch: investment-summary-panel
worktree: null
---

## Notes

Persist the materiały netto reduction per investment and adopt it on the investment page, the
investments list and /raporty.

### Why this exists

Diagnosed 2026-07-26 on investment 31: v1's „Bilans inwestora" and v2's „Do zapłaty" disagreed by
14 452,85 — the whole gap was materiały. The v2 panel priced materiały with a reduction that lived in
**localStorage + a plain `useState`**, so it could never reach the server-rendered v1 figures, and the
percent reset to the VAT rate on every reload while the on/off flag persisted.

The pass-through ruling (no `+VAT` term in margin; the reduction is a straight concession) lives in
`context/foundation/investment-financials-and-discount.md` › „Why plain materiały are absent from
marża".

### Owner decisions (2026-07-26)

1. **Default is `null` = off, face value.** Existing investments keep their v1 figures. Rejected:
   defaulting to 23% everywhere, which would silently rewrite margin and balance on every investment,
   closed ones included.
2. **Every surface adopts it** — investment page, investments list, /raporty. A surface that kept
   ignoring it would replace the diagnosed disagreement with a new one.
3. **The reduction is an independent commercial decision**, not a consequence of settlement mode: two
   investments settled identically can be priced differently. So the rate is its own field.
4. **At brutto settlement VAT is added on top, and the reduction makes no sense there** — the owner's
   own reason for greying the control in brutto mode.
5. **Material „wliczony w robociznę" (`settled`) is always netto** — not a mode, nothing to gate.
   `totalSettled` sums the brutto `amount`, so margin is understated by the VAT on every settled
   material. Parked as EX-595 because the rate source was unresolved (a brutto expense stores neither
   a net amount nor a VAT rate; the investment's `vatRate` is the client's rate on prace, not the
   shop's).

   > **Open:** EX-595 no longer exists in Linear, and `src/lib/db/sum-transfers.ts` still sums
   > `amount` for settled rows.

## Kept from the plan (`plan.md` / `plan-brief.md` deleted 2026-08-08)

- **Settlement mode stops being inert.** Switching an investment netto ↔ brutto now moves margin and
  balance with no change in transactions. Accepted deliberately — the two modes are different
  commercial arrangements. The saved rate is kept, not cleared, so returning to netto restores the
  figures.
- **`/raporty` is knowingly wrong and says so** — its cross-investment aggregate can't take a
  per-investment rate without a new query, so it carried a banner pending **EX-598**.

  > **Superseded:** /raporty is disabled outright until EX-598
  > (`src/app/(frontend)/raporty/page.tsx`).
- **The label is „Obniżka materiałów"** — deliberately not „Rabat" (that word names a transfer type)
  and not „Różnica" (which reads as a reconciliation error beside the Wpłaty/Rabat rows).
- **The double-strip guard is its own test case, not a clause**: feed both buckets (123 brutto + 100
  netto-billed) and assert the discount is exactly 23. Computing off `totalMaterialCosts` is the one
  edit that reintroduces the double cut, and it must turn that case red.
