# Kosztorys Section Append — Plan Brief

> Full plan: `context/changes/kosztorys-section-append/plan.md`
> Shaping decisions: `context/changes/kosztorys-section-append/change.md`

## What & Why

Add „Dodaj sekcję z szablonu": pick any sections from any saved szablony and append them — with prace, ceny j.m., and coefficients — into the current kosztorys. Today reuse only exists at two granularities: whole-szablon seed (empty kosztorys only) and the deferred single-praca autocomplete. The owner's real cases — "client wants this, this and this" and "client added a bathroom mid-job" — sit exactly between.

## Starting Point

S-09 shipped `kosztorys_presets` (whole-szablon snapshots, job fields zeroed at save) and an insert-only `applyPreset` that assumes an empty target. The editor's „Dodaj" menu has three inline actions; preset dialogs fetch lists lazily via server actions. Grid rows are mount-frozen `useState` — `router.refresh()` can't update them (EX-441).

## Desired End State

In the editor: „Dodaj" → „Sekcja z szablonu…" → searchable list of all sections grouped by source szablon → check several (across szablony) → one confirm appends them at the end, przedmiary at zero, no page reload. The same picker appears in the empty-kosztorys dialog, so an à-la-carte kosztorys is composed without a throwaway blank section.

## Key Decisions Made

| Decision        | Choice                                                    | Why (1 sentence)                                                                                      | Source  |
| --------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| Storage         | Unchanged — sections stay inside whole-szablon payloads   | Canonical/unique sections force upsert semantics + a conflict dialog on every save-as ("this is bad") | Shaping |
| Granularity     | Section-level **selection**, not section-level storage    | The payload already contains sections; a picker is a read-only lens, zero migration                   | Shaping |
| Scope           | Append-only v1; no write-side changes                     | "It must be simple" — full-szablon seed already covers day one                                        | Shaping |
| Multi-select    | Yes — checkboxes, one confirm                             | À-la-carte composition in one dialog instead of N round-trips                                         | Plan    |
| Entry points    | „Dodaj" menu **and** empty-kosztorys dialog               | The à-la-carte flow starts empty; without it the blocking dialog forces blank-section litter          | Plan    |
| Picker layout   | Flat searchable cmdk list, szablon group headers          | Fastest when he knows the name; source stays visible for duplicate names                              | Plan    |
| Grid refresh    | Action returns created slice → optimistic `setRows` patch | `router.refresh()` cannot re-seed mount-frozen rows (lesson + EX-441)                                 | Plan    |
| Duplicate names | Allowed, disambiguated by source label                    | No uniqueness constraint exists; appending a second „Łazienka" is legal                               | Shaping |

## Scope

**In scope:** `listPresetSections` (slim metas, no payloads to client) · `appendPresetSectionsAction` (transactional, multi-preset, returns slice) · small `appendPresetSections` insert helper (sections+items only, `MAX(display_order)+1`) · cmdk picker dialog · two entry-point wirings · optimistic grid patch · real-DB integration tests.

**Out of scope:** full-szablon seed path changes · „zapisz sekcję do szablonu" write-back · unique/canonical section names · stages/progress/settings in the append · fixing EX-438/439/440/441 · Playwright E2E (owed at the review gate / `e2e-backlog`).

## Architecture / Approach

Read-only lens over existing storage: server action lists `{preset, section, itemCount}` metas (cached, `presets` tag); confirm sends `{presetId, sectionId}[]`; server resolves payloads via `getPreset`, inserts sections+items in one transaction (seed-from-preset's exact transaction shape), returns the created slice with new ids; client appends rows optimistically and `router.refresh()`es prop-reading panels. Empty-kosztorys path reuses the existing `becamePopulated` remount instead.

## Phases at a Glance

| Phase          | What it delivers                                  | Key risk                                                         |
| -------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| 1. Server core | Listing + append action + integration tests (a–e) | Rollback correctness on partial-selection errors                 |
| 2. UI          | Picker dialog, both entry points, grid patch      | Grid staleness if the optimistic patch misses a row-shape detail |

**Prerequisites:** none — no migration, no new deps.
**Estimated effort:** ~2 sessions across 2 phases.

## Open Risks & Assumptions

- Concurrent appends can collide on `MAX+1` display_order — accepted (same class as S-09's empty-guard race); ambiguity in relative order only, no corruption.
- `getPreset` still applies payloads without schema-version checks (EX-439) — inherited, unchanged.
- Assumes preset counts stay small (server reads all payloads per cache miss) — true today, cached behind the `presets` tag.

## Success Criteria (Summary)

- Owner appends sections from several szablony into a live kosztorys in one dialog, values intact, no reload.
- An empty kosztorys can be composed purely from picked sections — no blank-section litter.
- Integration tests pin persisted state incl. rollback and duplicate-name cases.
