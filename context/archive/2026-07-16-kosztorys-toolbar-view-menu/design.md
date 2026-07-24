# Design: kosztorys toolbar → one "Widok" popover

## Problem

The v2 editor toolbar accumulated one reading-axis toggle per slice: `Widok cen`
(Klient / Z narzędziami / Bez narzędzi), `Kwoty` (Netto / Brutto / Bez filtra), `Etapy`
(Kwoty / % wykonania), `Widok tabeli` (Praca / Postęp / Bez filtra) — plus the `Kolumny`
picker button. Five segmented controls in a row. The owner reports it as unreadable.

## Key structural fact

The axes are **not the same kind of control**:

- **Union filters** — `Kwoty` and `Warstwy`. "Bez filtra" is not a third thing; it is
  just both sub-things shown. These collapse to two checkboxes each: `☑ Netto ☑ Brutto` =
  Bez filtra, one unchecked = the filtered view.
- **Single-select** — `Widok cen` (one price at a time, same numbers at a different stawka)
  and `Etapy` (a stage column is money _or_ percent). Checkboxes are wrong here; they stay
  radios.
- `Kolumny` is already a checkbox list.

A flat "check/uncheck everything" surface therefore can't be uniform — two axes are
genuinely pick-one.

## Decision

**Shape C** — one `Widok` popover with labeled, grouped sections, each keeping its native
control type. **`Widok cen` stays out** on the toolbar (most-flipped lens). Toolbar goes
from 5 controls → 2.

```
[ Widok cen: Klient | Z narzędziami | Bez narzędzi ]   [ Widok ▾ ]

Widok ▾
├─ Etapy      ○ Kwoty   ● % wykonania      (radio — pick one)
├─ Kwoty      ☑ Netto   ☑ Brutto           (checkboxes)
├─ Warstwy    ☑ Praca   ☑ Postęp           (checkboxes)
└─ Kolumny    ☑ Sekcja  ☑ Opis prac  …     (existing column items)
```

Icon + label per row.

## Architecture

- New `KosztorysViewMenu` (`src/components/kosztorys/`) — a single `DropdownMenu` with the
  four sections. The generic `src/components/ui/column-toggle-menu.tsx` is **shared with
  TanStack tables** and stays untouched; the new menu is kosztorys-specific and reuses only
  the item _shape_ / rendering pattern.
- Same `onSelect={(e) => e.preventDefault()}` trick the current picker uses so the menu
  survives multiple toggles in one visit.
- Consumes the existing context hooks via `useKosztorysEditorContext()` — no new wiring
  into `use-kosztorys-editor.ts` beyond what's already exposed.

## State: no new persisted state

The checkbox pairs are a **new skin over the existing tri-state hooks** — no migration, no
new localStorage key, hooks untouched.

- `useMoneyAxis` → `'net' | 'gross' | 'both'`; `useLayer` → `'work' | 'progress' | 'both'`.
- A small **pure helper** maps `(current tri-state, clicked box) → next tri-state`,
  enforcing **min-one-checked** — the last box can't be unchecked (no "hide all amounts"
  axis value exists, and it would be a nonsense view). This is the only genuinely new logic
  and the only unit-tested piece.
- `Etapy` (`values | percent`) is already pick-one — moves in verbatim as a radio group.
- `Kolumny` = existing `buildV2ToggleItems` + `onToggle`, unchanged.

"Bez filtra" disappears from `Kwoty` and `Warstwy` (now implicit = both checked).

## Build outline

1. `axis-checkboxes.ts` — pure tri-state ↔ checkbox-pair mapper with min-1 guard. **Unit-tested.**
2. `KosztorysViewMenu` — grouped dropdown; consumes existing context hooks.
3. Rewire `kosztorys-toolbar-view-toggles.tsx`: drop the 3 toggles, keep `Widok cen`, render
   `KosztorysViewMenu` where the old `Kolumny` button was.
4. Reshape `LAYERS` / `MONEY_AXES` options — drop the now-implicit `'both'` entry; reuse
   labels / icons / hints.

## Testing

- Mapper helper: min-1 guard + all four transitions per axis (Vitest unit).
- No E2E owed — the risk lives in the mapper (unit-covered); the rest is presentation.

## Out of scope

- `Widok cen` behaviour and price-view logic — untouched.
- The column-visibility / axis filter semantics in `buildV2Columns` — untouched; this is a
  toolbar-surface reshape only.
