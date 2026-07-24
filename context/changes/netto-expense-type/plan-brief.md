to# Netto investment-expense type — Plan Brief

> Full plan: `context/changes/netto-expense-type/plan.md`
> Design/spec: `context/changes/netto-expense-type/design.md`

## What & Why

The owner sometimes takes an investment invoice "na siebie" and reclaims the VAT, so he really pays
netto and wants to bill the investor netto too — while the cash still leaves the register at brutto.
A new transfer type `INVESTMENT_EXPENSE_NET` carries **two stored amounts**: `amount` (brutto, leaves
the kasa) and `netAmount` (netto, bills the investor). One expense, two planes.

## Starting Point

Today an investment expense (`INVESTMENT_EXPENSE`) has a single `amount` that both leaves the register
AND bills the investor. The kasa query (`sumRegisterBalance`) subtracts any non-deposit type at
`amount`; the materiały aggregate (`deriveFinancials`) folds all expense types into one
`totalMaterialCosts` that both bilanses read; a global kosztorys toggle can value all materiały netto.

## Desired End State

Adding a netto expense, the user types both brutto and netto (netto ≤ brutto). The register drops by
brutto; the investor's bilans / "Do zapłaty R+M" rises by netto. In Podsumowanie the net-type share is
a frozen netto row per kategoria, immune to the global toggle (no double cut). The list shows the
netto in a distinct color. Marża and every register balance are unchanged.

## Key Decisions Made

| Decision               | Choice                                               | Why                                                       | Source |
| ---------------------- | ---------------------------------------------------- | --------------------------------------------------------- | ------ |
| Model                  | Two stored amounts, not a VAT rate                   | Kills VAT math + rounding drift; B5 holds by construction | Design |
| `netAmount` mutability | Immutable (`access.update:false`)                    | Correction = cancel + re-add; removes the B6 edit path    | Plan   |
| Kasa                   | Untouched; net-type stays out of `DEPOSIT_TYPES`     | Register reconciles to the grosz at brutto, structurally  | Design |
| Double-deduction guard | Two-bucket split; net-type frozen, added post-toggle | Global toggle can't re-net an already-netto amount        | Design |
| Settling               | Net-type is NOT settleable                           | Keeps netto out of `totalSettled`/marża entirely          | Design |
| `EXPENSES_TAB_TYPES`   | Net-type joins it; cost math carved out in derive    | Shares routing/category/sheet; separate financial math    | Design |
| Podsumowanie breakdown | Separate netto row **per kategoria**                 | Brutto rows stay pure so the toggle cuts them cleanly     | Plan   |
| Tests                  | Structural units B1–B5, B7 now                       | "It reconciles" is the whole point of the spike           | Plan   |

## Scope

**In scope:** new type + `netAmount` field, two migrations, two-bucket financial split, editor payload
threading, toggle composition, per-category netto rows, create form + validation, list display, guards
B1–B5 + B7.

**Out of scope:** `netRate`/VAT math, `netAmount` edit path (B6), touching `sumRegisterBalance` /
`vatPlane`, settling the net-type, data backfill, audit log, B6 integration test, E2E, prod migration.

## Architecture / Approach

The spine is a **two-bucket split** in `deriveFinancials`: `INVESTMENT_EXPENSE_NET` rows go to
`materialsNetTypeNetto` (Σ `netAmount`, frozen), everything else to `materialsBruttoBase`. Downstream,
only the brutto base flows through the global toggle (`materialyPair` in `summary-economics.ts`); the
net-type bucket is added afterwards, untouched — so double-deduction is structurally impossible. Kasa
reads raw `amount` and is never touched. Bottom-up build: schema → financial split → editor threading
→ form/UI.

## Phases at a Glance

| Phase                        | What it delivers                                           | Key risk                                                |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| 1. Type + schema foundation  | Legal type, immutable `netAmount`, 2 migrations, consts    | Missing a `Record`/predicate seam (build catches most)  |
| 2. Financial split           | Two buckets; kasa/marża/settled untouched; B2–B4           | Net-type leaking into brutto base or `totalSettled`     |
| 3. Editor threading + toggle | Buckets to editor; frozen post-toggle; per-cat rows; B1,B5 | Two assembly sites drifting; toggle re-netting net-type |
| 4. Create form + list        | Typed netto ≤ brutto, persisted, shown in color; B7        | Which figure the list cell shows (netto)                |

**Prerequisites:** local dev DB reachable for the two migrations; branch `konradantonik/ex-536-zaliczka-v2`.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- The combined `totalMaterialCosts` is kept as base + netTypeNetto for convenience consumers; a
  consumer audit in Phase 2 confirms none re-net it.
- Row color: an unused `chart-*` token picked at implementation (owner: not amber).

## Success Criteria (Summary)

- Register drops by brutto; bilans / "Do zapłaty R+M" rise by netto; marża unchanged.
- Global toggle does not cut the net-type row a second time.
- `netAmount > amount` is rejected; guards B1–B5 + B7 green.
