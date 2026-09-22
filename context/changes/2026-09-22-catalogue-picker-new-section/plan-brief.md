# Nowa sekcja w „Dodaj pracę z katalogu" — Plan Brief

> Full plan: `context/changes/2026-09-22-catalogue-picker-new-section/plan.md`

## What & Why

„Dodaj do:" in the katalog picker only selects a sekcja that already exists. To put katalog prace into
a new one the owner has to close the dialog, mint „Nowa sekcja" (which arrives with a blank row),
rename it in the grid and reopen the picker. This change lets him type the new name in the picker
itself, with the sekcja and the prace written together.

## Starting Point

The dialog is keyed by `sectionId` and „Dodaj" is disabled until one is picked. `insertCatalogueItemsAction`
structurally requires an existing sekcja — `appendCatalogueItems` resolves the investment through the
sekcja's own row. The only automated escape today is `openPicker()` on an empty kosztorys, which runs
that same workaround (mint sekcja + blank row) on the owner's behalf.

## Desired End State

Typing a name that is not on the list offers „Dodaj „X"" and, on „Dodaj", the prace land in a brand-new
sekcja at the top of the rozpiska with no blank row above them. Typing a name that IS on the list —
in any case — lands them in that sekcja. „Anuluj" leaves nothing behind, because nothing is written
before „Dodaj".

## Key Decisions Made

| Decision                   | Choice                                                          | Why                                                                                                          | Source |
| -------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| Control                    | One `ui/combobox.tsx` with `allowCustom` + `modal`              | Already has the „Dodaj „X"" create row; one control beats a select plus a separate „new" affordance          | Chat   |
| Keying                     | Section **name**                                                | Owner ruling 2026-09-22: two sekcje of one name make no sense, so the name is identity                       | Chat   |
| When the sekcja is written | On „Dodaj", in the same transaction as the prace                | „Anuluj" must not leave an orphan sekcja                                                                     | Chat   |
| Blank first item           | Not created                                                     | `createSectionWithFirstItem` mints one so a 0-row sekcja is visible; here the prace are the rows             | Chat   |
| Placement                  | Top of the rozpiska (display_order 0)                           | Mirrors `addSectionAction`; a sekcja appended at the end of a 1000-row kosztorys has to be hunted for        | Plan   |
| Action shape               | A second action, not a union target                             | The lock target genuinely differs (`{investmentId}` vs `{kind:'section'}`), same split as add/insert section | Plan   |
| Name collision on write    | Append into the existing sekcja, report `createdSection: false` | The dialog's list is a snapshot; the server is the only place the identity rule can hold                     | Plan   |

## Scope

**In scope:** the combobox control and its name→target resolution; a create action plus the shared
placement engine behind both paths; the grid patch for a created sekcja; dropping the empty-kosztorys
pre-mint.

**Out of scope:** a uniqueness gate on the grid's inline rename; repairing the one duplicate pair in
the data; colour/etap on the new sekcja; multi-section insert.

## Architecture / Approach

Dialog holds a name → `resolveSectionTarget` (pure, node-tested) picks the action → either
`insertCatalogueItemsAction(sectionId, ids)` (unchanged) or
`createSectionWithCatalogueItemsAction(investmentId, name, ids)`. Both end in one shared
`placeCatalogueItems` extracted out of `appendCatalogueItems`, so pricing, the 65 % ceiling warnings
and the distinct display_orders are written once. The server returns the section slice plus
`createdSection`, and the picker host routes it to a prepend or a fold.

## Phases at a Glance

| Phase                    | What it delivers                                    | Key risk                                                      |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------- |
| 1. Server                | Create action + shared placement engine, DB-tested  | The extraction quietly changes the existing append path       |
| 2. Control               | Combobox + name resolution + action routing         | A typed name that matches an existing sekcja mints a twin     |
| 3. Grid patch & pre-mint | Created sekcja lands at the top; workaround removed | Rows parked at the array's end split the sekcja's band in two |

**Prerequisites:** local Postgres on 5433 for dev, the `db-test` container on 5435 for phase 1's spec.
**Estimated effort:** one session across the three phases.

## Open Risks & Assumptions

- The grid's inline rename can still create a twin name; from then on the picker reaches only the first
  of the pair. Accepted, recorded in `change.md`.
- One duplicate pair already exists in the dataset (1 of 185 sekcje) — its second sekcja is unreachable
  from this picker until renamed.
- The case-insensitive match assumes names differing only by case are the same sekcja to the owner —
  the same assumption the combobox's create row already makes.

## Success Criteria (Summary)

- Katalog prace reach a new sekcja without leaving the picker, and that sekcja has no blank row.
- A name already in use never produces a second sekcja of that name.
- Cancelling writes nothing — no sekcja, no prace.
