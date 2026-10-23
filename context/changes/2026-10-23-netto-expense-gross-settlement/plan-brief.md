# Netto expense bills netto plus the investment's VAT when materiały settle brutto — Plan Brief

> Full plan: `context/changes/2026-10-23-netto-expense-gross-settlement/plan.md`

## What & Why

With „Sposób rozliczenia materiałów: brutto” a netto wydatek inwestycyjny is still billed at its frozen
netto. Owner ruling 2026-10-23: under brutto it stays a special case and bills netto × (1 + the
investment's VAT rate).

## Desired End State

Under brutto: Karol Pawlak Mirabelki 5/93 (23%) bills 4504,73 instead of 3662,38; Mateusz Polis (8%)
switched to brutto bills 5698,08. Netto with a rate: unchanged.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Amount under brutto | netto × (1 + investment vatRate) | Owner ruling 2026-10-23 |
| Where the mode is picked | in the pure functions taking `netRate` | The mode toggles optimistically on the client |
| Breakdown under brutto | manager view: netto rows get „*” + footnote with the stawka | Owner request 2026-10-23 |
| „Lista wydatków” | unchanged | It lists the invoices' own figures |

## Phases at a Glance

| Phase | What it delivers |
| --- | --- |
| 1. Billing math | `billedMaterials` / `breakdownRowPair` take `vatRate`, tests first |
| 2. Callers and breakdown table | every caller passes `vatRate`; asterisk + footnote under brutto |

## Out of scope

Sheet sync, v1, marża v2, migrations.
