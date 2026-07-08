---
change_id: kosztorys-sections-items
title: In-app kosztorys — sections + items with live totals (S-01 north star)
status: implementing
created: 2026-07-08
updated: 2026-07-08
archived_at: null
---

## Notes

North star slice S-01 from `context/foundation/roadmap.md`. A Manager+ user can create,
rename, reorder, and delete kosztorys sections, and add, inline-edit, reorder, and delete
items (description, unit, przedmiar, pomiar, note) under them, seeing live row / section /
grand totals as they edit.

Shape is settled by the POC decision register — see `context/changes/kosztorys-mvp/change.md`.
Key POC decisions folded into S-01: unified item list (materials = `INVESTMENT_EXPENSE`, no
separate table); hard-delete; ▲▼ reorder over a `display_order` layer (DnD deferred);
przedmiar + pomiar as two independent columns (value computed from pomiar); two-mode discount
(`discount_type ∈ {percent, amount}` + `discount_value`); values computed, not stored (only
inputs persist). Port the tested calc core (`src/lib/kosztorys/calc.ts`, `v2-rows.ts`) from
the POC; drop the POC editor/migrations/`kosztorys_rooms`/seed scripts/inv-7 shortcut.

Additive-only: must not touch transfers/balance/marża write paths (FR-015).

**Scope decisions (2026-07-08, owner), during /10x-plan questioning:**

- **Fold S-03 in** — S-01 carries the three price views (klient / podwykonawca z narzędziami /
  własne narzędzia) + the "one dataset, three views" active-price toggle. dsg gotcha: the
  active view (and every column-shaping dimension) must be in the grid remount `key` (POC bug).
- **Coefficient model now → S-01 absorbs S-11.** Prices are NOT three stored snapshot columns;
  `client_price` is the snapshot, the two subcontractor views are derived via a markup
  coefficient inherited investment→section(nullable), with a per-item two-state override
  (`coeff`/`amount`/null). This lets us port the POC's _final_ `calc.ts` + `v2-rows.ts` verbatim
  (they already assume this model). Schema delta: `investments.w_tools_coeff`/`own_tools_coeff`,
  `kosztorys_sections.w_tools_coeff`/`own_tools_coeff` (nullable), item override fields.
- **VAT (S-12) stays out** — values are netto-only this slice; `rowGross` is ported but unwired
  (vatRate defaults 0). No `investments.vat_rate` yet.
- **Stages (S-04), catalogue (S-06), export (S-07) stay out.**
- **Tables = Payload collections** (`kosztorys-sections`, `kosztorys-items`), matching the POC
  and the rest of the app.
- **Reorder = immediate 2-write swap** (`swapItemOrderAction`, ▲▼ neighbors) — honors the
  "writes = real change" lesson; full DnD (sparse keys) deferred.
- **Tests = unit the pure core now** (calc + rows helpers + ≥1-item invariant); browser E2E
  deferred to S-08.

Update `roadmap.md` at archive time: S-11 is folded here (mark it done/absorbed); S-03 folded.
