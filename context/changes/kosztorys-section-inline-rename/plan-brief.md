# Kosztorys Section Inline Rename — Plan Brief

> Full plan: `context/changes/kosztorys-section-inline-rename/plan.md`

## What & Why

The grid's **Sekcja** cell is read-only, so a user who tries to rename a section where they naturally
look — in the grid — hits a wall and has to discover the separate section panel. Make the cell editable
so typing in it renames the whole section.

## Starting Point

The section name is denormalized onto every item row. `handleRenameSection` already fans a rename out
to all rows (+ `prevById`) and persists via `updateSectionFieldAction`; it's wired to the section panel
only. The grid column is hard-`disabled` to stop a per-row edit from desyncing the field.

## Desired End State

Click a Sekcja cell, type, blur/Enter → the whole section renames in the grid, the panel reflects it,
and it survives reload. Escape cancels.

## Key Decisions Made

| Decision             | Choice                            | Why                                                            | Source |
| -------------------- | --------------------------------- | -------------------------------------------------------------- | ------ |
| Rename fan-out       | Reuse `handleRenameSection`       | Correct fan-out + persist already exists; grid only exposes it | Plan   |
| Commit trigger       | Blur + Enter; Escape cancels      | Matches the section panel's commit model                       | Plan   |
| Empty name on commit | Allowed to persist                | User decision (diverges from panel's reject-empty — see risks) | Plan   |
| Delete-key on cell   | No-op (`deleteValue` returns row) | Prevent a stray Delete from blanking a whole section           | Plan   |
| Test obligation      | Defer E2E to `e2e-backlog`        | Fan-out logic pre-exists; browser cell spec is fiddly for LOW  | Plan   |

## Scope

**In scope:** `onRenameSection` option on the columns builder; editable `SectionNameCell`; wire
`handleRenameSection` into `columnOpts`; fix the header tooltip.

**Out of scope:** touching the rename handler/action/schema/hooks; empty-name guard; the panel;
column styling/width/position; writing the E2E now.

## Architecture / Approach

Replace the disabled `keyCol('sectionName', textColumn, { disabled: true })` with a plain column whose
`component` is a self-managing input (modeled on `UnitCell`) that calls `opts.onRenameSection(sectionId,
draft)` directly — never `setRowData` (a per-row write would desync the denormalized name). Two files:
`kosztorys-v2-columns.tsx` (option + cell + tooltip) and `use-kosztorys-editor.ts` (one-line wire).

## Phases at a Glance

| Phase                   | What it delivers                         | Key risk                                              |
| ----------------------- | ---------------------------------------- | ----------------------------------------------------- |
| 1. Editable Sekcja cell | Grid renames the whole section on commit | dsg cell focus/commit quirks; accidental Delete-blank |

**Prerequisites:** none — all dependencies exist.
**Estimated effort:** ~1 short session, single phase.

## Open Risks & Assumptions

- **Empty-name inconsistency:** the grid will allow an empty section name; the panel still rejects it.
  Deliberate per the decision, but a blank Sekcja may read as a bug.
- **dsg cell mechanics:** blur/Enter commit and Escape-revert on a self-managing input must play nicely
  with datasheet-grid's keyboard navigation and `keepFocus`.

## Success Criteria (Summary)

- Renaming a Sekcja cell updates every row of the section and persists across reload.
- Escape cancels; Delete does not blank the section.
- The section panel and grid stay in sync.
