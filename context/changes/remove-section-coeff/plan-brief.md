# Remove Per-Section Subcontractor Coeff — Plan Brief

> Full plan: `context/changes/remove-section-coeff/plan.md`

## What & Why

Remove the per-section subcontractor markup coeff tier (`wToolsCoeff`/`ownToolsCoeff` on
`kosztorys_sections`) and all machinery to edit, persist, undo, and serialize it, collapsing
`effectiveCoeff` to global-only. The section tier added complexity (a whole popover + patch/inverse +
denorm + DB columns) for a knob the business isn't using; the global tier and per-item overrides cover
the need. Also swaps the icon-only section buttons for explicit labeled ones.

## Starting Point

Subcontractor price derives from three coeff tiers today: **global (investment) → section → per-item
override**. The section tier is edited via a `SlidersHorizontal` popover in the section sidebar,
denormalized onto every v2 row, and carried through undo, serialization, snapshots, and preset append.

## Desired End State

`effectiveCoeff` reads the global coeff directly (per-item override still applies). No code references
the section coeff; the DB columns are gone. Each section in the sidebar shows two inline icon+label
buttons — „Dodaj pozycję do sekcji" and „Usuń sekcję" — and no coeff popover. Typecheck, lint, and the
kosztorys suite are green.

## Key Decisions Made

| Decision                   | Choice                                  | Why                                                               | Source   |
| -------------------------- | --------------------------------------- | ----------------------------------------------------------------- | -------- |
| Section button UX          | Inline icon + label (flex-wrap in w-72) | User picked compact single-row over stacked                       | Plan     |
| Dead `CoeffField.nullable` | Remove it                               | Section popover was its only caller; dead-code gated on typecheck | Plan     |
| Migration                  | Hand-written drop-column, no backfill   | AGENTS.md: kosztorys data throwaway pre-dogfooding                | Change   |
| `applySectionCoeff` action | Only strip 2 schema fields              | No dedicated action — rides shared `updateSectionFieldAction`     | Research |
| Serializer/snapshot        | No explicit edit                        | Section rides whole object; dropping the type field cascades      | Research |

## Scope

**In scope:** section coeff removal across collection, migration, types, calc, v2-rows patch/inverse,
row-ops, insert-rows, preset append, queries, seed, action schema, editor hook + prop chain, sidebar
popover + buttons, dead `nullable` variant, ~9 test files + 1 fixture, type regen.

**Out of scope:** global coeff tier, per-item override tier, data backfill/compat shim, prod migration
(human at ship time), delete-confirm dialog, „Nowa sekcja" button, broader sidebar restyle.

## Architecture / Approach

Removing a field from `KosztorysSectionT` / the v2 row type is an **atomic typecheck unit** — all
readers break until updated — so green typecheck is asserted at the end of Phase 3. Work bottom-up:
schema/collection → domain calc/serialization → editor state + UI → tests/fixtures/regen.

## Phases at a Glance

| Phase                  | What it delivers                                                          | Key risk                                                     |
| ---------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1. Schema & Collection | Drop-column migration + collection field removal                          | Dropping the wrong `w_tools_coeff` (investments vs sections) |
| 2. Domain Layer        | Types, calc→global-only, v2-rows, presets, queries, action schema         | Missing a denorm/read site → typecheck cascade               |
| 3. Editor & UI         | Hook state, prop chain, popover removal, labeled buttons, dead `nullable` | Long labels in w-72; leaving `globalCoeffs` prop orphaned    |
| 4. Tests & Regen       | Trimmed specs, fixture, `generate:types`, green suite                     | Deleting a global-coeff case by mistake                      |

**Prerequisites:** local docker DB up (5433); nothing else.
**Estimated effort:** ~1 session across 4 phases.

## Open Risks & Assumptions

- The section and investment coeff columns share names — the migration must target `kosztorys_sections`
  only (called out explicitly in Phase 1).
- `globalCoeffs` prop on `KosztorysSectionSummary` may become unused once the popover goes — drop it if
  so, gated on typecheck.

## Success Criteria (Summary)

- Subcontractor prices follow global coeff + per-item overrides only; no section influence.
- Section sidebar shows two labeled buttons per section, no coeff popover.
- `grep` for section-coeff symbols across `src/` is empty; typecheck + lint + kosztorys suite green.
