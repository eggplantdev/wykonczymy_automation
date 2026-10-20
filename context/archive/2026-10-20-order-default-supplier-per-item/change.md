---
change_id: order-default-supplier-per-item
title: One default supplier per order item — big bag and kontener come from separate companies
status: archived
created: 2026-10-20
updated: 2026-10-20
archived_at: 2026-10-20T09:00:48Z
branch: staging
worktree: null
---

## Notes

Big bag and kontener are supplied by separate companies: replace the single global defaultSupplierId in the order-settings global with one default per item type (bigBag, container). Shared supplier list stays. Switching the type in the pick step switches the preselected supplier; „Zapisz jako domyślnego dostawcę” saves the default for the selected type only. Existing defaultSupplierId migrates to the big bag default; container default starts empty. Hand-written migration. Follow-up to archived context/archive/2026-10-19-big-bag-order.

Added during review: „Ustawienia zamówień” shows and sets both defaults („Domyślny dostawca big bag” / „Domyślny dostawca kontenera” under the prices); the save action stores the sent defaults, nulling one whose row is gone. The star in the order dialog stays — it is the only way for a MANAGER.

## Decisions

- Per-supplier „what it delivers” tag with a filtered list (option B) was rejected: with 2–3 suppliers,
  one default per kind is enough.
- The migration doesn't guess the kontener default (a prod data choice) — after deploy someone sets it
  once in „Ustawienia zamówień”. A star click on prod between migrate and deploy lands on the old
  `default_supplier_id` column and is lost.
- Accepted: an owner saving „Ustawienia zamówień” overwrites a default a MANAGER starred while the form
  was open — last-write-wins already governs suppliers and prices in the same global.
