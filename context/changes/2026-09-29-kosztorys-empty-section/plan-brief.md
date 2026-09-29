# Sekcja bez pozycji w kosztorysie v2 — Plan Brief

> Full plan: `context/changes/2026-09-29-kosztorys-empty-section/plan.md`

## What & Why

A kosztorys v2 section must always hold at least one pozycja. A new section arrives with a blank row,
and deleting the last pozycja deletes the whole section. The owner never asked for this. It started
as a rendering workaround: the editor could only draw a section that had rows. This change lets a
section exist empty.

## Starting Point

The database, the tree loader, szablony and sheet import already carry an empty section. The editor
drops it on load, because it builds its section list from pozycje. Three things enforce "≥1
pozycja":

- the server seeds a first pozycja;
- the editor cascades the last-pozycja delete;
- a section with no rows cannot render.

## Desired End State

„Dodaj → Sekcja" creates a bare section. Deleting the last pozycja leaves the section.

On the owner's grid, a section without pozycje is a header band only, with „+ Dodaj pracę" in it.
It has no chevron and no footer. Rename, colour, move and insert above/below all work on it. Every
section's ⋯ menu has „Dodaj pracę".

It is hidden under search/filters and in podgląd, the link, wydruk oferty and wydruk pracownika.

## Key Decisions Made

| Decision                            | Choice                                        | Source |
| ----------------------------------- | --------------------------------------------- | ------ |
| „Dodaj → Sekcja"                    | Bare section, no blank first row              | User   |
| Deleting the last pozycja           | Section stays; cascade removed                | User   |
| Under search / filters              | Hidden                                        | User   |
| What sits under the header          | Header only + inline „+ Dodaj pracę" (var. C) | User   |
| „Dodaj pracę" in the ⋯ menu         | Yes, for every section                        | User   |
| Client outputs                      | Hidden                                        | User   |
| Chevron on an itemless section      | None                                          | Plan   |
| Name                                | „sekcja bez pozycji" (not „pusta")            | Plan   |
| Where section state lives           | Beside `rows` in the root hook, not provider  | Plan   |
| Section totals for „has rows" gates | Stay pozycja-based; lists read `sections`     | Plan   |
| EX-857 bulk delete                  | Must not bring the cascade back               | Plan   |

## Scope

**In scope:**

- section state in the editor;
- bare creation on the server;
- cascade removal;
- header button and ⋯ item;
- „Dodaj" menu and catalogue picker lists;
- undo safety across section delete;
- remount token;
- unit, DOM and integration specs;
- E2E spec edits (not runs);
- domain notes and the EX-857 note.

**Out of scope:**

- placeholder row;
- versions diff;
- extracting section handlers into a leaf hook (EX-702);
- bulk delete.

## Architecture

The editor gets a second state list, `sections`, seeded from the tree next to the item `rows`. It
becomes the only source of section order, name and colour. Rows stay pozycje only and are kept as
contiguous blocks in section order.

Pure ops live in a new `src/lib/kosztorys/section-list.ts`. Band building takes the list plus one
`showItemless` flag, which is off under preview, search or filters.

## Phases at a Glance

| Phase                                     | What it delivers                                               | Key risk                                                   |
| ----------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| 1. Pure section-list layer                | List ops, header-only band, edges, catalogue placement + specs | Row re-layout order wrong for a middle itemless section    |
| 2. Sections as editor state + bare create | Hook owns `sections`; server creates bare; no cascade          | Missed consumer still reading sections off rows; undo gaps |
| 3. Itemless section UI                    | „+ Dodaj pracę" on header and in ⋯; lists read `sections`      | Frozen columns reading a stale item count                  |
| 4. E2E specs + docs                       | Specs match new behaviour; domain notes; EX-857 note           | Specs edited but unrun until requested                     |

**Prerequisites:** none. No migration.

**Estimated effort:** one to two sessions.

## Open Risks & Assumptions

- `src/lib/actions/kosztorys.ts`, `kosztorys-editor-body.tsx` and the domain notes carry another
  agent's uncommitted edits. Touch only our hunks, and only append to the notes.
- „Dodaj → Praca" with no sections is two server calls. If the second fails, the section stays with
  no pozycje. That is a legitimate state now.
- The versions diff will not show adding or removing an empty section.

## Success Criteria

- An empty section survives a reload, rename, colour change, move, and deleting its last pozycja.
- „+ Dodaj pracę" on an empty section adds a pozycja under it.
- The client sees no empty section anywhere.
- Whole-tree gate green: typecheck, lint, test, test:integration, build.
