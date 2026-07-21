# Long-text cell overlay for the kosztorys grid — Plan Brief

> Full plan: `context/changes/kosztorys-note-cell-overlay/plan.md`

## What & Why

Long free text in the kosztorys grid can't be read. `textColumn` renders a single-line `<input>` in a
32px row, so a realistic opis — „szpachlowanie połaczeń ścian z gk i wklejanie taśmy wzmacniającej (
(łączenia pęknięć płyt, łączenia płyt gk etc.)" — shows about a quarter of itself and there is no way
to see the rest. Same for „komentarz".

## Starting Point

`DynamicDataSheetGrid` with a fixed `rowHeight={32}`; heights are uniform and not content-measured, so
wrapping is impossible without an overlay. Three text columns exist: `description` and `note` (stock
`textColumn`, commit via `setRowData`) and `sectionName` (a hand-rolled cell committing via an
`onRename` fan-out). Both item fields are already in `ItemPatchT`, so persistence needs no change.

## Desired End State

Clicking any text cell opens a textarea big enough to read and edit the whole value, sized so a
realistic opis fits without scrolling. Leaving the cell commits through that column's existing path.
Resting row height, grid appearance, and copy-paste are unchanged, and there is one text-editing
implementation instead of two.

## Key Decisions Made

| Decision                 | Choice                             | Why                                                                                                         | Source  |
| ------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------- |
| Overlay mechanism        | In-cell absolute textarea          | Least machinery; `.dsg-cell` doesn't clip, and `disableKeys`/`keepFocus` are the library's sanctioned hooks | Shaping |
| Rejected: Radix Popover  | No                                 | Portal + focus trap fights DSG's keyboard model                                                             | Shaping |
| Rejected: per-row height | No                                 | Breaks uniform rows and grows every column in the row                                                       | Shaping |
| Scope                    | All three text columns             | Same pain in `description`; one dumb cell covers all commit paths                                           | Plan    |
| Enter semantics          | Enter commits, Shift+Enter newline | Matches Sheets and every other cell in the grid                                                             | Plan    |
| Hover-to-read            | Deferred                           | Owner wants an eyeball test of the overlay alone first                                                      | Shaping |
| E2E                      | File to `e2e-backlog`              | No kosztorys editor fixture exists; building one dwarfs the change                                          | Plan    |

## Scope

**In scope:** a generic `long-text-cell.tsx`; adoption by `description`, `note`, and `sectionName`;
deletion of `section-name-cell.tsx`.

**Out of scope:** hover-to-read, per-row expansion, any persistence/autosave change, a new E2E fixture.

## Architecture / Approach

One presentational cell that knows nothing about the domain: it takes `value` and `onCommit(next)`.
Each column supplies its own `onCommit` — `setRowData` for the item columns, `onRenameSection` for the
section column — so the branching lives at two wiring sites rather than inside the component. Columns
are built by spreading `textColumn` (the existing `floatColumnLeft` idiom), which inherits
copy/paste/delete for free.

## Phases at a Glance

| Phase                          | What it delivers                          | Key risk                                                                                    |
| ------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1. Cell + `description`/`note` | Overlay editing on both item text columns | Overlay stacking — rows are absolutely positioned siblings, so it needs an explicit z-index |
| 2. Migrate `sectionName`       | One implementation; old cell deleted      | Regressing the rename fan-out or the no-op-on-Delete guard                                  |

**Prerequisites:** none — no migration, no env, no new dependency.
**Estimated effort:** one session; Phase 1 is the bulk, Phase 2 is wiring plus a deletion.

## Open Risks & Assumptions

- Assumes an overlay on a row near the grid's bottom edge stays usable; `.dsg-container` is
  `overflow: auto`, so it may extend the scroll area slightly. Covered by a manual check.
- Phase 2 touches working code. If the rename fan-out proves awkward to express through the generic
  `onCommit`, keeping `SectionNameCell` is an acceptable stopping point — Phase 1 stands alone.

## Success Criteria (Summary)

- A full-length opis is readable and editable without leaving the grid
- Section rename still fans out to every row of the section, and Delete still can't blank it
- The grid looks and behaves exactly as before when no cell is focused
