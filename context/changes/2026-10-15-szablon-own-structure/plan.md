# Szablon — own structure Implementation Plan

## Overview

A szablon stops being an `investments` row whose prace live in `kosztorys_items` with a dead copy of
the katalog's fields. It gets its own Payload collections — `templates` → `template-sections` →
`template-items` — where a praca is a katalog reference + sekcja + kolejność and nothing else, plus
its own „Wersje” (`template_snapshots`, refs only), its own kosz kind and its own editor actions. The
shared editor stays one editor and receives the action set from its route. Decisions 1–9 and the
rationale: `change.md` § Plan decisions.

## Current State Analysis

- A szablon is an investment with `status = 'szablon'` (EX-893, `20260914_0`, `20260929_1`); its
  tree is `kosztorys_sections` / `kosztorys_items`. Since EX-1017 its prace read the katalog through
  an overlay JOIN in `src/lib/db/kosztorys-tree.ts:88-92` (only when `host.status = 'szablon'`), and
  `splitTemplatePatch` routes opis / tłumaczenia / j.m. / cena / the 4 overrides to the katalog. The
  row's own copy of those fields is never read by the app and never refreshed.
- The editor's write side: every editor file imports its action directly (no actions object). The
  szablon-reachable ones go through `investmentAction` + `investmentGateForRow` + `TABLE_BY_KIND`
  (`src/lib/db/investment-gate.ts:16-20,97-110`), which also sets `isTemplate` and calls
  `markPresetEdited` (`investments.content_edited_at`).
- The tree also reads investment-level `w_tools_coeff` / `own_tools_coeff` / `vat_rate` /
  `settlement_mode`; both szablony on prod carry exactly the defaults (verified 2026-10-15).
- Revision token for „external change” reload: `investments.updated_at`
  (`bumpInvestmentRevision`, `useExternalChangeReload`).
- Six investment readers exclude szablony by hand: `src/hooks/.../guard-template-status.ts`
  (registered `src/collections/investments.ts:7,46`), `src/lib/queries/reference-data.ts:85`,
  `src/lib/db/worker-payout-pairs.ts:30`, `src/lib/db/catalogue-usage.ts:21`,
  `src/lib/db/snapshots.ts:84`, `PICKABLE_INVESTMENT_STATUSES`.
- „Wersje”: `kosztorys_snapshots.investment_id NOT NULL ON DELETE CASCADE`
  (`20260710_1`), payload = full `SnapshotPayloadT` (opis, ceny, stawki…).
- Kosz: a szablon rides the investment trash; `src/lib/queries/trash.ts:57` maps it to
  `kind: 'template'` (`TrashKindT` already has it).
- Copy paths that can carry an unlinked praca into a szablon: reload-from-preset, append, restore,
  apply-preset. `savePresetAction` already drops them with a warning (`cataloguedPresetTree`,
  `src/lib/actions/kosztorys-presets.ts:64`).
- `deleteCatalogueItemAction` (`src/lib/actions/work-catalogue.ts:133`) already removes the praca
  from every szablon and bumps `content_edited_at`.
- Prod: „Kosztorys 2026 kolory” live — 302 prace (all linked), 11 sekcje, 3 wersje. „Kosztorys 2026”
  trashed — 310 prace (none linked), 6 wersje.

## Desired End State

- `templates`, `template-sections`, `template-items` (Payload collections) and `template_snapshots`
  (raw) hold every szablon. `template_items.catalogue_item_id` is `NOT NULL` FK
  `ON DELETE CASCADE` — the schema cannot hold a copy or an unlinked praca.
- No `investments` row has, or can have, status `szablon`; the enum value is gone; no investment
  reader carries a szablon filter.
- `/szablony` and `/szablony/[id]` work as today for the owner: create empty, rename, edit (sekcje,
  prace from katalog, kolejność, tłumaczenia), „Wersje”, kosz + restore + 30-day purge, „Zapisz jako
  szablon” (new / overwrite), „Wczytaj ponownie”, „Sekcja z szablonu”, nowa inwestycja z szablonu.
- The AI kosztorys scripts read a szablon through REST on the new collections.

Verify: the phase checks below, the migration count check on a local prod-dump copy, and the
Whole-tree Gate.

### Key Discoveries:

- `20260929_1_szablon_as_investment.ts` is the precedent for an id-mapped `INSERT … SELECT` move incl.
  snapshots; `20260929_2_drop_kosztorys_presets.ts` its destructive twin.
- Equipment is the trash-kind template: `src/lib/actions/equipment-trash.ts`,
  `src/lib/db/equipment-trash.ts`, `src/lib/equipment/purge-trash.ts`, cleanup step in
  `src/app/(payload)/api/cron/cleanup/route.ts`.
- `src/__tests__/helpers/template.ts` (`createTestTemplate`) is used by 9 specs; E2E touching szablony:
  `e2e/kosztorys-presets.spec.ts`, `e2e/kosztorys-structure.spec.ts`, `e2e/szablony-list.spec.ts`,
  `e2e/investment-lock.spec.ts`.
- Lessons that bind this plan: new Payload collection = nine migration items (lessons.md „Nowa
  kolekcja Payloada kosztuje…”); ADD and DROP never in one migration and the DROP is **authored only
  after the additive deploy is live** („A migration that both ADDs and DROPs…”); a trash kind needs
  `trashed_at` in each raw reader; a unique key stays taken while trashed; pad migration counters.

## What We're NOT Doing

- No „founded from szablon X” link on a kosztorys (decision 8).
- No change to kosztorys behaviour, kosztorys actions or `KosztorysEditorProvider` (EX-496).
- No new szablon-editor E2E spec (decision 7) — the four existing specs are updated.
- No migration of the trashed „Kosztorys 2026” (decision 4).
- No per-szablon coefficients / VAT / settlement — constants (change.md, „Derived”).
- Section-name translations are keyed by name and are not touched.

## Implementation Approach

Build the new world beside the old one (Phases 1–6), with the old szablon path working until Phase 7
cuts it. Phase 7 removes szablon-as-investment from the code but leaves the old rows in the DB; they
are deleted by migration 2, which is **written in Phase 9, after the code is live on prod** — a
migration file that exists rides the next `pnpm db:migrate:prod`, so authoring it early would delete
the szablon before the deploy that stops reading it.

New React-free template logic lives in `src/lib/kosztorys/templates/`; single statements + mappers in
`src/lib/db/templates*.ts`; mutations in `src/lib/actions/template-*.ts`.

## Critical Implementation Details

- **Deploy sequence** (owner runs every migration): M1 → preview, push staging, verify; M1 → prod
  (before push), push, deploy live; then Phase 9 authors M2 → preview, verify staging; M2 → prod;
  Vercel Data Cache purge. A szablon edit during the M1→deploy build window is lost (accepted); between
  deploy and M2 the old szablon row shows on investment lists (accepted, minutes).
- **Id spaces collide**: `template_items.id` / `template_sections.id` overlap `kosztorys_items` ids,
  so every injected action is bound to its plane at the route, and every per-id localStorage key gets
  a template namespace (`kosztorys-view:`, `kosztorys-filters:`, `table-columns:kosztorys-stages`,
  `kosztorys-v2-row-heights`).
- **Code between Phase 7 and M2 must tolerate a leftover `status = 'szablon'` investment** (status
  label / badge lookups must not throw on an unknown value).

## Phase 1: Schema + migration 1 (additive)

### Overview

The new tables exist and hold the live szablon; nothing reads them yet.

### Changes Required:

#### 1. Collections

**File**: `src/collections/templates.ts`, `src/collections/template-sections.ts`,
`src/collections/template-items.ts`, `src/payload.config.ts`

**Intent**: Payload collections in the style of `kosztorys-sections.ts` / `kosztorys-items.ts`;
access = management read, writes through actions (REST read for the AI scripts).

**Contract**: `templates { name (unique incl. trashed), content_edited_at, trashed_at }`;
`template-sections { template (rel, cascade), name, display_order, color }`;
`template-items { section (rel, cascade), catalogue_item (rel NOT NULL, cascade), display_order }`.
Default `created_at` / `updated_at`.

#### 2. Snapshot table + payload type

**File**: `src/lib/kosztorys/templates/snapshot-payload.ts`

**Intent**: The refs-only shape a szablon version stores.

**Contract**: `TemplateSnapshotPayloadT = { sections: { name, color, catalogueItemIds: number[] }[] }`
with `schema_version` 1. Table `template_snapshots` mirrors `kosztorys_snapshots` columns
(`taken_at`, `taken_by`, `kind`, `label`, `schema_version`, `payload`) with
`template_id NOT NULL REFERENCES templates ON DELETE CASCADE` and the same two indexes.

#### 3. Migration 1

**File**: `src/migrations/20261015_2_add_template_tables.ts` (+ `index.ts` entry) — re-check the
latest file and `git status src/migrations` first.

**Intent**: Create the 4 tables (lessons.md nine-item checklist: `payload_locked_documents_rels`
column + index per collection, timestamps + indexes, composite read indexes
`(template_id, display_order)` / `(section_id, display_order)` / `(template_id, taken_at DESC)`,
unique `lower(name)` on `templates`, reverse-order `down()`), then copy every **non-trashed**
`status = 'szablon'` investment: template row, sections, linked items only, and its snapshots
converted from `SnapshotPayloadT` to `TemplateSnapshotPayloadT` (TS loop inside `up()`; items without
`catalogueItemId` dropped). Additive and orderless — no live code reads the new tables.

### Success Criteria:

#### Automated Verification:

- `pnpm generate:types` emits the three collections.
- M1 applies on the local DB restored from the latest prod dump (`pnpm db:import`, then `payload migrate`).
- Count check on that DB: one template; its sections / items / snapshots equal the source szablon's
  11 / 302 / 3 (or the dump's current figures); every converted snapshot's catalogue ids exist.
- `down()` then `up()` again applies cleanly.

#### Manual Verification:

- None — nothing user-facing yet.

---

## Phase 2: Data layer + template gate

### Overview

Read and gate a szablon from the new tables, in the shape the editor already consumes.

### Changes Required:

#### 1. Tree read

**File**: `src/lib/db/template-tree.ts`

**Intent**: Return the szablon tree in the editor's existing tree shape — sections + items whose
opis / tłumaczenia / j.m. / ceny / overrides come from `work_catalogue_items`, quantities and stage
fields empty, coefficients / VAT / settlement from `DEFAULT_COEFFS` / `DEFAULT_VAT` /
`SETTLEMENT_MODE_DEFAULT`.

**Contract**: `selectTemplateTreeData(db, templateId)` → same type as `selectKosztorysTreeData`.

#### 2. Template statements

**File**: `src/lib/db/templates.ts`

**Intent**: Single statements for the template plane: create / rename / list (non-trashed, with
counts), section and item insert / update / delete / reorder, revision bump (`templates.updated_at`),
`markTemplateEdited` (`content_edited_at`), read revision.

#### 3. Gate

**File**: `src/lib/actions/template-action.ts` (+ `src/lib/db/template-gate.ts`)

**Intent**: Twin of `investmentAction` for the template plane: resolves the template by template /
section / item id, refuses a trashed one with `TEMPLATE_TRASHED_MESSAGE` (moved here from the
investment gate), bumps the revision and `content_edited_at` on success, revalidates
`presets` + `entityTag('template', id)`.

#### 4. Serialize for seeding

**File**: `src/lib/kosztorys/templates/serialize-template.ts`

**Intent**: A szablon as the `SnapshotPayloadT` that `seed-from-preset`, `reload-from-preset`,
`append-preset-sections` and `apply-preset` already accept, values resolved from the katalog — those
callers stay unchanged.

**Contract**: `serializeTemplate(db, templateId, sectionIds?)` → `SnapshotPayloadT`.

#### 5. Test helper

**File**: `src/__tests__/helpers/template.ts`

**Intent**: `createTestTemplate` builds on the new tables (katalog entries created for its prace).

### Success Criteria:

#### Automated Verification:

- New `src/__tests__/lib/db/template-tree.test.ts`: katalog wording is what the tree returns; a katalog
  edit shows on the next read; coefficients are the defaults.
- New `src/__tests__/lib/actions/template-action.test.ts`: a trashed szablon is refused; a write
  bumps revision and `content_edited_at`.
- New `src/__tests__/lib/kosztorys/templates/serialize-template.test.ts`: section filter, order.

#### Manual Verification:

- None — not wired to the UI yet.

---

## Phase 3: Template actions + editor injection

### Overview

The shared editor writes through an action set handed in by its route; the szablon route hands the
template set.

### Changes Required:

#### 1. Editor action contract

**File**: `src/components/kosztorys/editor/editor-actions.ts`

**Intent**: The type of the action set the editor calls, and the kosztorys implementation of it
(wrapping today's actions unchanged). Passed as a prop from the route into `use-kosztorys-editor.ts`
and down to the dialogs that call actions — never through `KosztorysEditorProvider`.

**Contract**: `EditorActionsT` covering the szablon-reachable set: item field update, section field
update, add / insert / remove section, add item, insert catalogue items, section with catalogue items,
remove item, renumber, write layout, clear, auto / named snapshot + list + restore, fill translations,
save section translations, catalogue note, refresh, read revision. Actions the szablon never shows
(stages, totals, settlement, clean texts, apply / save catalogue, sheet, share) stay direct imports.

#### 2. Template action set

**File**: `src/lib/actions/template-*.ts` (`template-tree.ts`, `template-structure.ts`,
`template-translations.ts`; snapshots in Phase 5)

**Intent**: The template implementation of `EditorActionsT` on `templateAction`. An item field edit
writes the katalog entry (every editable szablon column is a katalog field); a section field edit
writes `template_sections`; add-praca keeps today's „katalog required” rule.

#### 3. Adopt in the editor

**Files**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`,
`editor/hooks/use-auto-snapshot.ts`, `editor/hooks/use-snapshot-list.ts`,
`editor/actions/fill-translations-action.tsx`, `editor/dialogs/clear-kosztorys-dialog.tsx`,
`editor/dialogs/kosztorys-versions-drawer.tsx`, `editor/dialogs/save-version-dialog.tsx`,
`editor/dialogs/new-item/new-item-dialog.tsx`, `editor/dialogs/new-item/new-item-form.tsx`,
`editor/dialogs/reorder/reorder-dialog.tsx`, `editor/dialogs/preset/*-dialog.tsx`, plus the
section-translation / catalogue-note call sites, and both routes: `src/app/(frontend)/szablony/[id]/page.tsx`
and the kosztorys editor route.

**Intent**: Call the injected set instead of the direct import. The szablon route loads
`selectTemplateTreeData` and passes `templateId` + the template set; the kosztorys route passes the
kosztorys set. Template-namespaced localStorage keys.

### Success Criteria:

#### Automated Verification:

- New `src/__tests__/lib/actions/template-structure.test.ts`: each template action writes the template
  tables and leaves `kosztorys_items` / `kosztorys_sections` untouched (row counts before / after);
  item field edit lands on the katalog entry.
- Existing editor DOM specs pass with the kosztorys set injected:
  `pnpm exec vitest run src/__tests__/components/kosztorys`.

#### Manual Verification:

- Szablon „Kosztorys 2026 kolory” → change opis, j.m., cena, a stawka: the change shows in katalog prac.
- Szablon → add sekcja, rename, colour, move; add praca from katalog, remove, reorder: survives reload.
- Szablon → „Uzupełnij tłumaczenia (AI)” fills section names and missing opis translations.
- Any kosztorys → the same edits behave exactly as before (no regression from the injection).

---

## Phase 4: Szablony in circulation

### Overview

Every path that lists, creates, overwrites or copies a szablon reads and writes the new tables.

### Changes Required:

#### 1. List + lifecycle

**Files**: `src/app/(frontend)/szablony/page.tsx`, `src/components/.../presets-data-table.tsx`,
`src/components/tables/presets.tsx`, the create-empty dialog, `preset-row-actions`,
`src/components/nav/template-crumb.tsx`, `src/lib/kosztorys/create-template.ts`,
`src/lib/db/presets.ts`, `src/lib/actions/kosztorys-presets.ts`

**Intent**: List, create empty (INSERT into `templates`), rename (owner-only, name unique incl.
trashed — a taken name says it is in the kosz), crumb, all from `templates`.

#### 2. Save as / overwrite

**Intent**: „Zapisz jako szablon” new → template + sections + linked items from the source kosztorys
(unlinked dropped with today's warning); overwrite → named template snapshot „Przed nadpisaniem: …”
on the transaction handle first, then replace that template's sections / items.

#### 3. Copy paths out of a szablon

**Files**: `src/lib/kosztorys/seed-from-preset.ts`, `reload-from-preset.ts`,
`append-preset-sections.ts`, `apply-preset.ts`, `src/lib/actions/create-investment.ts:39`, promote-lead,
`add-investment-dialog`, `investment-form` (`:186-196`), `use-preset-sections`

**Intent**: Source via `serializeTemplate`; the pickers list `templates`. Section picking in
„Sekcja z szablonu” uses `template_sections` ids.

#### 4. Katalog side

**Files**: `src/lib/actions/work-catalogue.ts:133`, `src/lib/db/catalogue-usage.ts`, katalog dialogs
listing szablon names

**Intent**: Delete keeps today's behaviour via the FK cascade — collect affected template ids before
the delete to bump `content_edited_at`; `deleteTemplateRowsOfCatalogueItem` goes. Usage lists read
`template_items`.

### Success Criteria:

#### Automated Verification:

- Rewritten DB specs on `createTestTemplate` pass (save new / overwrite + its restore point, reload,
  append, seed on create, catalogue delete cascades and bumps the szablon): the 9 specs importing it.
- New case: a name held by a trashed szablon is refused.

#### Manual Verification:

- `/szablony` → „Nowy szablon”, rename, open: works; a name already used (also by one in the kosz) is refused.
- A kosztorys with a praca not in katalog → „Zapisz jako szablon”: saved, warning names the skipped praca.
- „Nadpisz” an existing szablon: replaced; „Wersje” of that szablon has „Przed nadpisaniem: …”.
- Nowa inwestycja z szablonu (also from a lead): kosztorys seeded with the szablon's sekcje and prace.
- A kosztorys → „Wczytaj ponownie z szablonu” and „Sekcja z szablonu”: correct sekcje / prace.
- Katalog prac → delete a praca used in a szablon: it leaves the szablon.

---

## Phase 5: „Wersje” szablonu

### Overview

Versions of a szablon live in `template_snapshots`, refs only.

### Changes Required:

#### 1. Snapshot plane

**Files**: `src/lib/db/template-snapshots.ts`, `src/lib/actions/template-snapshots.ts`

**Intent**: Auto (same throttle as kosztorys), named, list, restore, GC with the kosztorys bands.
Restore = auto restore point on the transaction handle, wipe the template's sections / items,
re-insert from refs; a ref whose katalog entry is gone is skipped and counted into the warning.

### Success Criteria:

#### Automated Verification:

- New `src/__tests__/lib/db/template-snapshots.test.ts`: capture → list; restore re-creates layout;
  restore after a katalog delete skips that praca with a warning; GC keeps the bands.

#### Manual Verification:

- Szablon → „Zapisz wersję”, change things, „Przywróć”: layout back, opisy in today's katalog wording.
- Delete a praca from katalog, restore a version that had it: restored without it, warning shown.

---

## Phase 6: Kosz szablonu

### Overview

A szablon has its own trash kind, modelled on equipment.

### Changes Required:

#### 1. Trash kind

**Files**: `src/lib/actions/template-trash.ts`, `src/lib/db/template-trash.ts`,
`src/lib/kosztorys/templates/purge-trash.ts`, `src/app/(payload)/api/cron/cleanup/route.ts`,
`src/lib/queries/trash.ts:57`, `EntityNameT` (+ `'template'`), `TEMPLATE_TRASH_TAGS`

**Intent**: Trash / restore / „Usuń na zawsze” (typed name, server-checked) / 30-day purge on
`templates.trashed_at`; every raw template reader filters `trashed_at`. `presets` leaves
`INVESTMENT_TRASH_TAGS`.

### Success Criteria:

#### Automated Verification:

- New `src/__tests__/lib/actions/template-trash.test.ts`: trash → hidden from list / pickers,
  editor refuses; restore; forever-delete needs the typed name; purge removes rows past 30 days
  (cascade takes sections / items / snapshots).

#### Manual Verification:

- `/szablony` → „Do kosza”: gone from the list and from every picker; visible in `/kosz` as szablon.
- `/kosz` → restore: back with its prace and wersje. „Usuń na zawsze” asks for the name.

---

## Phase 7: Szablon leaves the investment code

### Overview

No code knows a szablon as an investment. Old rows stay in the DB until Phase 9.

### Changes Required:

#### 1. Remove the exclusions and the overlay

**Files**: `guard-template-status.ts` (+ registration `src/collections/investments.ts:7,46`),
`src/lib/queries/reference-data.ts:85`, `src/lib/db/worker-payout-pairs.ts:30`,
`src/lib/db/catalogue-usage.ts:21`, `src/lib/db/snapshots.ts:84`, `PICKABLE_INVESTMENT_STATUSES` →
`INVESTMENT_STATUSES`, `src/lib/db/kosztorys-tree.ts:88-92` overlay, `splitTemplatePatch`,
`isTemplate` / `markPresetEdited` / `TABLE_BY_KIND` szablon branches in `src/lib/db/investment-gate.ts`

**Intent**: Delete; `isTemplate` survives only as the route-given editor flag that hides totals /
stages.

#### 2. Remove the status

**Files**: `src/collections/investments.ts` (status options), `src/lib/constants/investment-status.ts:10,21,54`,
`investment-lock.ts:14,42` (`TEMPLATE_INVESTMENT_STATUS`), status badge,
`investment-schema.ts:13-14`, worker-report refusal (`share-refusal.ts:7`,
`worker-report-share.ts:62`, `worker-report-scan.ts:30`)

**Intent**: Delete the value and every branch on it; unknown status renders without throwing.

### Success Criteria:

#### Automated Verification:

- `grep -rn "'szablon'" src` returns only migrations and Polish UI copy.
- Affected specs pass: `pnpm exec vitest run` on the specs that referenced these files (list from
  the grep at implement time).

#### Manual Verification:

- Inwestycje list, filtry statusu, formularz inwestycji: no „Szablon” option; everything else as before.
- Raport pracownika and payouts pickers: unchanged for real investments.

---

## Phase 8: Scripts, E2E, docs

### Changes Required:

#### 1. Scripts (decision 9)

**Files**: `context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/prod-client.ts` (+ its
callers), `src/scripts/fill-translations-from-catalogue.ts`, `fill-description-translations.ts`,
`fix-kosztorys-descriptions.ts`, `seed-kosztorys-presets.ts`, `seed-kosztorys-structure.ts`; delete
`link-kosztorys-items-to-catalogue.ts`, `sync-template-translations.ts`

**Intent**: AI scripts read `template-items?depth=1` via REST; translation / typo scripts drop the
„szablony included” branch; seeds checked against the new model.

#### 2. E2E

**Files**: `e2e/kosztorys-presets.spec.ts`, `e2e/kosztorys-structure.spec.ts`,
`e2e/szablony-list.spec.ts`, `e2e/investment-lock.spec.ts`

**Intent**: Follow the new route / data; run by the owner, not the agent.

#### 3. Docs

**Files**: `context/reference/kosztorys-editor-domain-notes.md`, `context/foundation/lessons.md`,
`AGENTS.md` (where it says a szablon is an investment), research.md residuals

**Intent**: State the new model; lesson: a szablon is references, the schema says so.

### Success Criteria:

#### Automated Verification:

- `pnpm exec tsc --noEmit` reaches no deleted script (covered by the Whole-tree Gate).
- The two deleted scripts are absent.

#### Manual Verification:

- AI kosztorys loader against a szablon (local): pozycje resolved with katalog wording, no duplicates.

---

## Phase 9: Migration 2 — after the deploy is live

### Overview

Written only once Phases 1–8 are live on prod (track with a Linear issue at ship time). Deletes the
old szablon rows and the enum value.

### Changes Required:

#### 1. Migration 2

**File**: `src/migrations/<date>_N_drop_szablon_investments.ts` with the `RUN-AFTER-DEPLOY` marker

**Intent**: Delete every `status = 'szablon'` investment incl. the trashed „Kosztorys 2026” (cascade
takes its sections / items / snapshots / locked-docs rows); drop `investments_szablon_name_idx`;
recreate `enum_investments_status` without `szablon` (rename old type, create new, drop + restore the
`'active'` default around `ALTER COLUMN … TYPE … USING status::text::…`, drop old type). Optionally
drop `investments.content_edited_at` if no reader remains. `down()` re-adds the enum value and column
only (data is not restorable).

### Success Criteria:

#### Automated Verification:

- Applies on a local prod-dump copy after M1; then `select count(*) from investments where status::text = 'szablon'` fails on the enum / returns 0, and no orphan `kosztorys_items` remain.

#### Manual Verification:

- Staging after M2: `/szablony` unchanged, inwestycje list has no szablon row.

---

## Testing Strategy

### Unit / DB tests:

- Template tree read, gate, serialize, each template action's table isolation, versions incl.
  skip-on-deleted-katalog, trash incl. unique name while trashed, the 9 rewritten `createTestTemplate`
  specs.

### Integration Tests:

- The four szablon E2E specs, updated (owner runs).

### Manual Testing Steps:

1. Phase bullets above, on local (5435 db-test or the dev DB restored from a prod dump).
2. Staging rehearsal of the full deploy sequence before prod.

## Migration Notes

- M1 additive, before push; M2 destructive with `RUN-AFTER-DEPLOY`, authored after the deploy.
- Data Cache purge in Vercel after M2.
- Verified on a local prod-dump copy before each prod step; prod migrations are run by the owner.

## Whole-tree Gate

Run once, after Phase 8:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (owner's go — not run unasked)
- `pnpm test:integration`
- `next build --webpack` in the worktree (lessons.md, Turbopack in a worktree)

## References

- Decisions: `context/changes/2026-10-15-szablon-own-structure/change.md`
- Research: `context/changes/2026-10-15-szablon-own-structure/research.md`
- Move precedent: `src/migrations/20260929_1_szablon_as_investment.ts`, `20260929_2_drop_kosztorys_presets.ts`
- Trash precedent: `src/lib/actions/equipment-trash.ts`, `src/lib/equipment/purge-trash.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema + migration 1 (additive)

#### Automated

- [x] 1.1 `pnpm generate:types` emits the three collections — 3548dad4e
- [x] 1.2 M1 applies on the local DB restored from the latest prod dump — 3548dad4e
- [x] 1.3 Count check: sections / items / snapshots match the source szablon; converted ids exist — 3548dad4e
- [x] 1.4 `down()` then `up()` applies cleanly — 3548dad4e

### Phase 2: Data layer + template gate

#### Automated

- [x] 2.1 `template-tree.test.ts` passes — 3184c2074
- [x] 2.2 `template-action.test.ts` passes — 3184c2074
- [x] 2.3 `serialize-template.test.ts` passes — 3184c2074

### Phase 3: Template actions + editor injection

#### Automated

- [x] 3.1 `template-structure.test.ts` passes (table isolation, katalog write) — bcde016f9
- [x] 3.2 Editor DOM specs pass with the kosztorys set injected — bcde016f9

### Phase 4: Szablony in circulation

#### Automated

- [x] 4.1 The 9 `createTestTemplate` specs pass on the new tables — d1648a678
- [x] 4.2 Trashed-name refusal case passes — d1648a678

### Phase 5: „Wersje” szablonu

#### Automated

- [x] 5.1 `template-snapshots.test.ts` passes — b68eb31bb

### Phase 6: Kosz szablonu

#### Automated

- [x] 6.1 `template-trash.test.ts` passes — c9b0c202d

### Phase 7: Szablon leaves the investment code

#### Automated

- [x] 7.1 `'szablon'` grep returns only migrations and UI copy
- [x] 7.2 Affected specs pass

### Phase 8: Scripts, E2E, docs

#### Automated

- [ ] 8.1 No reference to deleted scripts (Whole-tree Gate typecheck)
- [ ] 8.2 The two one-off scripts are deleted

### Phase 9: Migration 2 — after the deploy is live

#### Automated

- [ ] 9.1 M2 applies on a local prod-dump copy after M1; no szablon rows or orphans remain
