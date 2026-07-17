---
title: Forced "add first section" dialog — temporary dogfooding stopgap for empty kosztorys
status: draft
created: 2026-07-13
temporary: true
supersedes: null
related: EX-463 (durable server-side auto-seed remains the real fix)
---

## Why

Dogfooding editor v2: opening an **existing** empty investment (zero sections) is a dead
end — the "＋ pozycja" toolbar button is hidden (no section id to attach to), and the only
"Nowa sekcja" button is buried in the side panel. The current empty-state banner offers
preset-seeding only.

The durable fix (EX-463) auto-seeds a section + blank item on **new** investment creation,
but explicitly leaves existing empty investments out of scope. This dialog is a **temporary,
client-side** stopgap covering every empty kosztorys (new + existing) with no migration.
It can be deleted once EX-463 (+ import slice S-12) fully covers the space.

## Behavior

When `tree.sections.length === 0`, `kosztorys-editor-v2.tsx` renders a centered,
**non-dismissible** dialog (no X, no Esc, no overlay-click close). The user cannot reach
the empty grid until they act. Two ways out:

1. **Create a named section** — one autofocused text input, prefilled with the default
   name (`NEW_SECTION_DEFAULTS.name`), + primary "Utwórz sekcję" button. Calls
   `handleAddSection(name)`, which creates the section + a blank item (a 0-item section
   renders as 0 rows, i.e. still invisible). The empty→populated transition remounts the
   editor and the dialog unmounts.
2. **Seed from preset** — the existing `SeedFromPresetButton`, moved into the dialog as a
   secondary action (preserves current capability; dropping it would regress).

## Changes

The dialog lives in the shell (`kosztorys-editor-v2.tsx`), not the body, so it reuses the
shell's existing empty→populated remount machinery (`becamePopulated`) exactly like
seed-from-preset — no touch to `use-kosztorys-editor.ts` / `handleAddSection`.

- `src/lib/kosztorys/seed-blank.ts` — `seedBlankKosztorys(payload, investmentId, name?)`:
  optional name, falls back to `NEW_SECTION_DEFAULTS.name`. This is the same helper EX-463's
  auto-seed already uses (section + blank item), so the dialog and the auto-seed share one
  code path.
- `src/lib/actions/kosztorys.ts` — NEW `seedBlankSectionAction(investmentId, name?)`: thin
  `protectedAction` wrapper over `seedBlankKosztorys`, revalidates
  `['kosztorysSections', 'kosztorysItems']`.
- `src/components/kosztorys/empty-kosztorys-dialog.tsx` — NEW. shadcn `Dialog`,
  non-dismissible (always-open, `showCloseButton={false}`, Esc / outside-click prevented).
  Section-name input + "Utwórz sekcję" → `seedBlankSectionAction` → `onCreated()`. Embeds the
  existing `SeedFromPresetButton` as the secondary path.
- `src/components/kosztorys/kosztorys-editor-v2.tsx` — render the dialog when
  `sections.length === 0`; remove the old dashed preset-only banner (its job moves inside).

## Out of scope

- The durable EX-463 auto-seed on `createInvestmentAction` — untouched, still the real fix.
- Section renaming beyond the create-time name; inline grid rename already exists.
- No tests (temporary stopgap, dogfooding only) — flagged deliberately.
