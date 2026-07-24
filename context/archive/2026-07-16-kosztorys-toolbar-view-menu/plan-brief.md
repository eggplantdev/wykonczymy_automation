# Kosztorys toolbar → one "Widok" popover — Plan Brief

> Full plan: `context/changes/kosztorys-toolbar-view-menu/plan.md`
> Design brief: `context/changes/kosztorys-toolbar-view-menu/design.md`

## What & Why

The v2 editor toolbar grew one reading-axis toggle per slice — four segmented controls plus a
`Kolumny` picker in a row. The owner reports it as unreadable ("za dużo przełączników"). Collapse
it into two controls: keep `Widok cen` out on the toolbar, and fold the other three axes + the
column picker into a single `Widok` popover.

## Starting Point

Four `KosztorysToolbarToggle`s live on the left (`Widok cen`, `Kwoty`, `Etapy`, `Warstwy`); the
`Kolumny` picker (`ColumnToggleMenu`) sits in the right actions group. Each axis persists a
tri-state string in the `table-columns:` localStorage family via its own hook.

## Desired End State

Toolbar left cluster is `[ Widok cen … ]  [ Widok ▾ ]`. `Widok` opens a grouped popover: `Etapy`
(radio), `Kwoty` (☑ Netto ☑ Brutto), `Warstwy` (☑ Praca ☑ Postęp), `Kolumny` (column checkboxes).
Toggling reacts and persists exactly as today. The right group loses its `Kolumny` button.

## Key Decisions Made

| Decision                  | Choice                                                           | Why                                                                            | Source |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| Surface shape             | One popover, grouped labeled sections (Shape C)                  | Max consolidation while each axis keeps a control type that fits its semantics | Design |
| Union axes as checkboxes  | Kwoty & Warstwy → two checkboxes each; `'both'` becomes implicit | "Bez filtra" was never a third thing, just both-on                             | Design |
| Pick-one axes stay radios | Widok cen (out) + Etapy (in popover)                             | Only one price / one stage-display at a time — checkboxes are meaningless      | Design |
| Widok cen placement       | Stays on toolbar, left of `Widok`                                | Most-flipped lens; keep it one click away                                      | User   |
| Widok button placement    | Left, beside Widok cen                                           | The two reading controls read as one cluster                                   | User   |
| State model               | No new state — checkbox pairs skin the existing tri-state hooks  | Zero migration; hooks/storage untouched                                        | Design |
| Tests                     | Unit only on the pure mapper                                     | Only real logic is the mapper; rest is presentation over tested hooks          | User   |

## Scope

**In scope:** new `KosztorysViewMenu` popover; pure tri-state↔checkbox mapper + unit test;
toolbar rewire (drop 3 toggles + right-side `Kolumny`); trim `'both'` from `MONEY_AXES`/`LAYERS`.

**Out of scope:** `Widok cen`/price-view logic; `buildV2Columns` filter semantics; the shared
`ColumnToggleMenu` generic and its TanStack adapter; persisted state / storage keys / axis types;
E2E.

## Architecture / Approach

`KosztorysViewMenu` is a single `DropdownMenu` using the already-shipped `DropdownMenuRadioGroup` /
`DropdownMenuCheckboxItem` primitives, consuming `useKosztorysEditorContext()` directly. Money and
layer boxes derive from / write to the existing tri-state hooks through a shared pure helper
(`axis-checkboxes.ts`) with a min-one-checked guard. The generic `ColumnToggleMenu` stays as-is
for TanStack tables; the new menu is kosztorys-specific.

## Phases at a Glance

| Phase            | What it delivers                                | Key risk                                                              |
| ---------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| 1. Mapper        | Pure tri-state↔checkbox helper + unit test      | Min-1 guard / round-trip correctness (unit-covered)                   |
| 2. Menu + rewire | `KosztorysViewMenu`, toolbar swap, options trim | A stray consumer of the dropped `'both'` option (caught by typecheck) |

**Prerequisites:** none — builds on the shipped `kosztorys-layer-toggle` slice.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Assumes nothing outside the two toolbar files reads the `'both'` element of `MONEY_AXES`/`LAYERS`
  — verified by typecheck at Phase 2.
- No browser-level guard that the popover wires the right hook — accepted; caught by dogfooding.

## Success Criteria (Summary)

- Toolbar shows two controls (`Widok cen` + `Widok`); the busy toggle-row is gone.
- Every axis + column toggle works and persists exactly as before, from inside one popover.
- A Kwoty/Warstwy box always stays checked (no empty "hide all amounts" state).
