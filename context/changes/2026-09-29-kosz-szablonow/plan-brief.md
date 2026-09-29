# Szablony kosztorysów go to the trash — Plan Brief

> Full plan: `context/changes/2026-09-29-kosz-szablonow/plan.md`
> Research: `context/changes/2026-09-29-kosz-szablonow/research.md`

## What & Why

„Usuń szablon” on /szablony currently hard-deletes the szablon. The DB cascade then removes its sections, items and every restore point, and nothing can bring them back. Once this change lands, deleting a szablon moves it to `/kosz` instead, as already happens with investments. A mistaken delete can then be undone for 30 days (EX-914). This is the first entity from the umbrella trash research (`kosz-pozostalych-encji`).

## Starting Point

A szablon is already an `investments` row with `status = 'szablon'`, so the investment trash (`trashed_at`, restore, delete-forever, 30-day purge) mostly covers it. One check blocks it today: `trashInvestmentAction` refuses a szablon. There is also a gap: the szablon readers in `src/lib/db/presets.ts` never filter `trashed_at`.

## Desired End State

On /szablony, „Przenieś do kosza” is available to every management role. Once moved, the szablon disappears from the list, from every szablon picker, and from its own page. On `/kosz` it appears in its own „Szablony” section with a 30-day countdown. There it can be restored with its tree and versions intact, or deleted forever by typing its name. Creating or renaming a szablon to the name of a trashed one is refused, and the message points to the trash.

## Key Decisions Made

| Decision                  | Choice                                                                            | Why (1 sentence)                                                                                                                        | Source            |
| ------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Auto-purge                | Yes, after 30 days, like an unused investment                                     | Matches the owner's ruling that the trash holds mistakes. `KOSZTORYS_USED` is always false for a szablon, so no purge change is needed. | Research + owner  |
| Delete forever            | Always requires the typed name                                                    | A szablon's value is its content, and a quantity-based "used" test can never be true for it.                                            | Owner             |
| Name of a trashed szablon | Stays taken; the message points to /kosz                                          | No migration, and restore can never collide.                                                                                            | Owner             |
| /kosz layout              | A separate „Szablony” section; empty sections hidden                              | This is the per-kind shape the next four entities will reuse.                                                                           | Owner             |
| Who may trash             | Every MANAGEMENT role; rename stays owner-only                                    | Parity ruling for all trash sections. A reversible trash no longer needs the owner-only guard the hard delete had.                      | Umbrella decision |
| Entry point               | Reuse the investment trash actions; delete `deletePresetAction`                   | One path, and nothing outside the trash can destroy a szablon.                                                                          | Plan              |
| Cache                     | Add `'presets'` to `INVESTMENT_TRASH_TAGS`; no key bump                           | Tags are fixed before the handler runs. No trashed szablon exists before deploy, so old cache entries stay valid.                       | Plan              |
| Readers                   | Filter `trashed_at IS NULL` in every `presets.ts` reader, including `listPresets` | This hides the szablon everywhere, whether EX-909 lands before or after.                                                                | Plan              |

## Scope

**In scope:**

- A trashed szablon is hidden from lists, pickers, seed/overwrite/reload/append, rename, its page and the crumb.
- A trashed szablon cannot be written to; the gate refuses with a szablon-worded message.
- „name is in the trash” refusal on create and rename.
- The trash accepts a szablon, delete-forever requires the typed name for it, and the `presets` tag is expired on every trash action.
- `/kosz` sections, kind-aware dialog and toasts, and the /szablony trash dialog.
- Updates to the domain notes and the test-plan risk row.

**Out of scope:**

- Changing the unique name index.
- Separate szablon trash actions.
- Hiding the Rename button from a MANAGER in the UI.
- Changes to purge or retention.
- Flota, Sprzęt, Kasy and Pracownicy (EX-915–918).

## Architecture / Approach

Hide first, then open the door.

- Phase 1 makes every szablon reader treat a trashed szablon as absent. Nothing can be trashed yet, so this changes no behaviour on real data.
- Phase 2 removes the refusal and wires in the tags and the typed-name rule.
- Phase 3 adds the UI. `/kosz` partitions one query result by `isTemplate` into titled sections.

## Phases at a Glance

| Phase                             | What it delivers                                                        | Key risk                                                                       |
| --------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1. Hide a trashed szablon         | Filtered readers, `presetNameHolder`, szablon gate message              | A reader missed means a trashed szablon leaks into a picker.                   |
| 2. The trash accepts a szablon    | Refusal removed, typed-name rule, `presets` tag, hard delete removed    | The UI still calls the removed action until Phase 3, so land 2 and 3 together. |
| 3. /szablony and /kosz, plus docs | Row trash dialog, per-kind sections, kind-aware dialog and toasts, docs | Merge conflict with EX-908 (`router.refresh` removal in the same files).       |

**Prerequisites:** none. EX-909 and EX-908 can land in either order; see the plan for how to merge them.
**Estimated effort:** about 1 session across 3 phases.

## Open Risks & Assumptions

- The working tree holds uncommitted work from other sessions, including `test-plan.md`. Commit by path only.
- EX-909 edits `createEmptyPresetAction` and moves the page and crumb to the cached `getPresets()`. The `listPresets` filter covers that move.

## Success Criteria (Summary)

- A szablon deleted by mistake can be restored from `/kosz` with its sections, items and versions intact.
- A trashed szablon cannot be found or used anywhere, and its name is reported as "in the trash" rather than silently taken.
- Kosztorysy created from the szablon are untouched by trashing it or deleting it forever.
