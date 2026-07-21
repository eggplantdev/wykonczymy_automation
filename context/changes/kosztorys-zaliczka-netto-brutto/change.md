---
change_id: kosztorys-zaliczka-netto-brutto
title: Deposit (zaliczka) transactions carry both netto and brutto
status: plan_reviewed
created: 2026-07-21
updated: 2026-07-21
archived_at: null
branch: konradantonik/ex-536-kosztorys-zaliczka-netto-brutto
worktree: null
---

## Notes

deposit (zaliczka) transactions must carry both netto and brutto (EX-536, owner-confirmed 2026-07-21). Today the deposit-type transaction has no netto/brutto choice; add it. Mechanic (store both / choose per deposit cash-vs-invoice / derive one from the other) is undecided and must be shaped. Unblocks EX-535.

### Owner constraints (2026-07-21)

- **„Zaliczka" is misleading — the concept is „wpłata" (payment).** Rename in UI. Every payment is a wpłata; it is not specifically an advance. Code identifier follows accordingly (English), UI label „wpłata".
- **Drop the stage link.** The deposit type is currently linked to an etap; that link is removed — wpłaty are not per-etap (cf. temp_notes „BRAK PRZYPISANIA DO ETAPU WPLAT").
- **Podsumowanie shows wpłaty on both axes.** The summary must carry „wpłaty netto" and „wpłaty brutto" as differentiated figures, not one.

### Mechanic — REVISED after shaping (owner, 2026-07-21) — see `design-bilans-vat-planes.md`

The original „arkusz does ×(1+vat) on the wpłata" mechanic is **dropped**. The owner's objection:
converting an already-paid amount ±VAT changes nothing. What matters is _„ile POWINIEN zapłacić z VAT
a ile bez"_ — the obligation, not the payment.

- **The flag is a BUCKET CLASSIFIER, not a converter.** A wpłata stores `amount` + a three-state
  `vatPlane: 'NET' | 'GROSS' | null` (DB: `vat_plane varchar` + CHECK, nullable). The amount is always the
  real cash; the flag only says which bucket it lands in — netto or brutto. **No ×(1+vat) is ever applied
  to a wpłata.** A three-state union (not a nullable boolean) so legacy `null` can never be confused with
  `'NET'` — `false`/`NULL` would collapse under any `!flag` shortcut, exactly the bug the buckets must avoid.
- **Sequential calc model (owner-confirmed, „dokładnie"):**
  ```
  baseLeft          = robocizna − Σ(wpłaty netto)                       only a FLAGGED netto wpłata reduces the base pre-VAT
  Do zapłaty netto  = baseLeft − Σ(legacy)                              legacy subtracts at face (as the old code did)
  Do zapłaty brutto = baseLeft × (1+vat) − Σ(wpłaty brutto) − Σ(legacy) brutto wpłata + legacy both at face on the gross axis
  ```
  VAT dolatuje tylko do reszty zobowiązania, nigdy do wpłaty. → **`toNet` NOT needed**; `toGross` runs
  only on `baseLeft`. Worked: robota 2000, wpłata 1000 netto → baseLeft 1000 → netto 1000, brutto 1080.
  Legacy-only: robota 2000, legacy 1000 → netto 1000, brutto 2000×1,08 − 1000 = **1160** (identical to the
  old code on both axes).
- **Both figures always visible.** „Do zapłaty netto" + „Do zapłaty brutto" render in Podsumowanie
  **regardless of the `MoneyAxisToggle`** (netto / brutto / pokaż wszystko) — the toggle must not hide a
  real obligation figure.
- **The four figures are one locked set (owner, 2026-07-21).** Wpłaty netto/brutto + Do zapłaty
  netto/brutto always render **together, as a group**, on every axis — netto and brutto shown as a pair so
  a single number can't mislead the client. Architecture consequence: lift the four out of the
  axis-gated waterfall grid into their **own always-visible block**, **shared by the collapsed headline
  and the expanded state** (one source, so the two render paths can't drift — that is the „in sync"
  requirement). The block is **visually distinct/prominent** („niech to będzie jasne"). Rabat / Łącznie
  stay axis-gated in the waterfall as today.
- **Legacy (`null` plane) behaves EXACTLY as the old code — CORRECTED twice (owner, 2026-07-21).** First
  the „exclude legacy" idea was dropped (a wpłata always reduces the debt); then the „fold legacy into the
  net base" idea was **also dropped** — that grossed legacy on the brutto axis, changing the number. The
  owner is firm: legacy is old data, it must render **identically to the pre-change code — subtracted at
  face on BOTH axes.** Mechanism: legacy is **not** in `baseLeft` (so it never gets grossed); it subtracts
  at face from both Do zapłaty figures, exactly as the old single `wplatyNet` did. Only the **flagged**
  netto/brutto buckets drive the new sequential model. So a legacy-only investment shows the **same netto
  AND brutto** as today (netto R−legacy, brutto R×1,08−legacy). **No DB backfill** — rows stay `null`.
  Legacy MAY show as its own amber „wpłaty bez oznaczenia VAT" line, but that line **subtracts** — amber is
  a visual „unmarked/old", never „excluded".
- **Only INVESTOR_DEPOSIT.** No single-wpłata cash+invoice split (a split is two transactions).
- **DEFERRED (later, „if needed we will add it"):** an owner-typed „Policz bez VAT" obligation target
  (Wariant A), materiały netto/brutto (`÷(1+vat)`), per-etap VAT coeff. Bilans-inwestora slice, not this change.

### Deposit type scope — resolved (owner, 2026-07-21)

The bucket flag and the „Do zapłaty" reducer see **only `INVESTOR_DEPOSIT`**. Rather than filter the
read layer, close it at the source: **trim the deposit form picker (`DEPOSIT_UI_TYPES`) to
`INVESTOR_DEPOSIT` only** — drop „Inna wpłata" (`OTHER_DEPOSIT`) and „Zasilenie z konta firmowego"
(`COMPANY_FUNDING`). Data (prod copy, 2026-07-21): `COMPANY_FUNDING` has **0** rows linked to an
investment (never touches a kosztorys „Do zapłaty" anyway); `OTHER_DEPOSIT` has 4 (5 453 zł), legacy.
So no new deposit can be created outside the model, and the buckets/reducer see only investor wpłaty by
construction — no extra read-layer filter needed. The wider union teardown (`TransferTypeT` + predicates,
fate of the 26+13 existing rows) stays parked under **EX-557**; only the picker trim rides with EX-536.

### Companion (separate issue, goes FIRST): restore `paymentMethod`

The field exists and is fully wired (`transfers.ts:115`, DB `payment_method`, types/queries/filters/
mapping/schemas/export/actions, app-table column at `transfers.tsx:158`); the forms hardcode `'CASH'`
so every row is silently gotówka. Work: expose the picker + ensure the column is visible, and **trim the
enum to gotówka (CASH) + przelew (TRANSFER)** — drop BLIK/Karta (check existing rows first).
**Orthogonal to netto/brutto** (gotówka może być z VAT lub bez) — its own small issue, done before the rest.
