# Szablony kosztorysów go to the trash — Implementation Plan

## Overview

„Usuń szablon” on /szablony currently hard-deletes the szablon: the DB cascade takes its tree and every restore point. After this change it moves the szablon into `/kosz`, where it gets its own „Szablony” section. The szablon disappears from every list and picker, and it can be restored for 30 days. After that the cron purges it. „Usuń na zawsze” always asks for the typed name. Linear **EX-914**.

## Current State Analysis

A szablon is an `investments` row with `status = 'szablon'` (EX-893). The investment trash already runs on the hand-rolled `trashed_at` column. Only one line in the trash path looks at status: the refusal in `trashInvestmentAction`. Everything else is status-blind: restore, delete-forever, the purge, and the write gate (`lockMessageOf`).

The gap is on the read side. Investments hide trashed rows at one chokepoint (`fetchReferenceData`), but szablony have their own reader set in `src/lib/db/presets.ts`, and none of those readers filter `trashed_at`. The name checks and the partial unique index both count a trashed szablon.

Full map: `research.md` in this folder.

## Desired End State

- /szablony: „Usuń” becomes „Przenieś do kosza”, open to every MANAGEMENT role. Once trashed, a szablon is absent from:
  - the list and every picker (new investment, lead promote, „Zapisz jako szablon → Nadpisz”, „Wczytaj szablon”, „Dodaj sekcje z szablonu”);
  - its own `/szablony/[id]` page (404) and the crumb.
    Nobody can write to it.
- `/kosz` shows a „Szablony” section next to „Inwestycje”. An empty section is hidden, and „Kosz jest pusty” appears only when both are empty.
  - A szablon row counts down 30 days, like an unused investment.
  - „Przywróć” brings it back with its tree, name and versions intact.
  - „Usuń na zawsze” always requires the typed name.
- Creating or renaming a szablon to a trashed szablon's name is refused with „Szablon o tej nazwie jest w koszu — przywróć go albo usuń na zawsze.”
- Rename stays owner-only.

Verify by trashing a szablon on /szablony, checking that it is gone from each picker and that `/szablony/<id>` 404s, then restoring and deleting forever from `/kosz`.

### Key Discoveries:

- The only status check in the trash path is `src/lib/actions/investment-trash.ts:45-50`.
- `KOSZTORYS_USED` (`src/lib/db/investment-trash.ts:10-20`) is always false for a szablon. Its quantities are stripped (`serialize-preset.ts:23-36`), and the editor has no quantity column (`workshop-columns.ts:28-36`). So a szablon purges like an unused investment, which matches the owner's ruling. The typed-name rule therefore has to be a separate kind check. Folding it into the fragment would stop the purge, and the fragment's own comment (`:5-9`) forbids the label and the purge disagreeing.
- The szablon readers are `isTemplateInvestment` :32, `getPresetName` :39, `renamePreset` :68, `templateOwnersOfSections` :83, `listPresetSections` :108 and `listPresets` :132, all in `src/lib/db/presets.ts`. Every caller of `isTemplateInvestment` wants a _live_ szablon: seed (`seed-from-preset.ts:24`), overwrite (`kosztorys-presets.ts:89`) and delete (`:148`, which is being removed).
- `protectedAction` fixes its tag list before the handler runs (`run-action.ts:44,62`). The `/kosz` restore and delete-forever buttons serve both kinds, so the tag union goes on the shared `INVESTMENT_TRASH_TAGS` (`src/lib/cache/tags.ts:64`).
- The gate already knows `isTemplate` (`src/lib/db/investment-gate.ts:47,86`), so it can word the trashed refusal for a szablon.

## What We're NOT Doing

- No change to the unique index `investments_szablon_name_idx`: no migration, and the name stays blocked by a trashed szablon (owner, 2026-09-29).
- No separate szablon trash actions. `trashInvestmentAction`, `restoreInvestmentAction` and `deleteInvestmentForeverAction` serve both kinds.
- No UI role gating on /szablony. A MANAGER still sees a Rename button the server refuses; that quirk exists today.
- No changes to `KOSZTORYS_USED`, the purge selection or `TRASH_RETENTION_DAYS`. Moving the constant belongs to the umbrella's step 0, not here.
- No edits to archived docs (`context/archive/2026-09-24-kosz-inwestycji/`).
- Flota / Sprzęt / Kasy / Pracownicy (EX-915–918).

## Implementation Approach

Hide first, then open the door.

- **Phase 1** makes every szablon reader treat a trashed szablon as absent. It also teaches the name checks to say "it's in the trash". Nothing can be trashed yet, so this phase is behaviour-neutral on real data.
- **Phase 2** removes the refusal, adds the szablon typed-name rule and the `presets` tag, and drops `deletePresetAction`.
- **Phase 3** puts it in front of the user: the /szablony row action and the `/kosz` section. It also updates the docs.

## Critical Implementation Details

- **No cache-key bump.** lessons.md:1084-1098 says to bump `['presets']` / `['preset-sections']` when a result's meaning changes. Here, no szablon can have `trashed_at` before this ships, because the refusal is still live. So every entry cached before deploy equals what the filtered query returns. Leave the keys alone.
- **EX-909 order-independence.** Put the `trashed_at IS NULL` filter in `listPresets` as well as in `getPresetName`. EX-909 moves the page and crumb from `getPresetName` to the cached `getPresets()`; with the filter in both, either landing order keeps a trashed szablon's page a 404.

## Phase 1: Hide a trashed szablon everywhere it is read

### Overview

Every szablon reader and write-guard treats a trashed szablon as absent. The name checks can tell a live holder from a trashed one. The gate words its refusal for a szablon.

### Changes Required:

#### 1. Szablon readers

**File**: `src/lib/db/presets.ts`

**Intent**: A trashed szablon must not be listed, picked, seeded from, overwritten, reloaded from, appended from, renamed, or rendered.

**Contract**:

- Add `AND trashed_at IS NULL` to the szablon predicate of `isTemplateInvestment`, `getPresetName`, `listPresets`, `listPresetSections` and `templateOwnersOfSections`.
- In `renamePreset`, add it to the **target row** (`WHERE id = … AND status = … AND trashed_at IS NULL`) and not to the `NOT EXISTS` subquery. The subquery mirrors the index, and the index still covers trashed rows.
- Update the module and function comments where they say "szablon" to mean "live szablon" (`isTemplateInvestment` is now "is a live szablon").

#### 2. Name holder instead of a boolean

**File**: `src/lib/db/presets.ts`, `src/lib/kosztorys/create-template.ts`, `src/lib/actions/kosztorys-presets.ts`

**Intent**: A name refused because a trashed szablon holds it must say so. Otherwise the user is told the name exists while no such szablon is visible.

**Contract**:

- Replace `isPresetNameTaken(db, name, exceptId?) → boolean` with `presetNameHolder(db, name, exceptId?) → Promise<'live' | 'trashed' | undefined>`. It uses the same `SAME_NAME` comparison and status filter, and reads `trashed_at` to classify the holder.
- `createTemplate` returns `{ id } | 'name-taken' | 'name-in-trash'`.
- In `kosztorys-presets.ts`, add `NAME_IN_TRASH_MESSAGE = 'Szablon o tej nazwie jest w koszu — przywróć go albo usuń na zawsze.'`. `savePresetAction` (new) and `createEmptyPresetAction` map `'name-in-trash'` to it.
- When `renamePreset` returns false, `renamePresetAction` asks `presetNameHolder(db, name, id)`:
  - `'trashed'` → `NAME_IN_TRASH_MESSAGE`
  - `'live'` → `NAME_TAKEN_MESSAGE`
  - `undefined` → `TEMPLATE_NOT_FOUND` (the target itself is trashed or gone)
- `createEmptyPresetAction` is also edited by EX-909 (`expireCollectionsAfterResponse` line). Touch only its `created === …` mapping.

#### 3. Gate wording for a szablon

**File**: `src/lib/constants/investment-lock.ts`, `src/lib/db/investment-gate.ts`

**Intent**: An editor tab left open on a szablon that was trashed meanwhile refuses writes with a szablon sentence, not „Inwestycja jest w koszu”.

**Contract**:

- New `TEMPLATE_TRASHED_MESSAGE = 'Szablon jest w koszu — przywróć go, żeby coś zmienić.'`.
- `lockMessageOf` returns it when `trashed_at != null` and `status === TEMPLATE_INVESTMENT_STATUS`. The trashed check still wins over the completed check.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/db/presets.test.ts`
  - A trashed szablon is absent from `listPresets`, `listPresetSections`, `templateOwnersOfSections`, `getPresetName` and `isTemplateInvestment`.
  - `renamePreset` refuses a trashed target.
  - `presetNameHolder` returns `'live'`, `'trashed'` and `undefined`, and honours `exceptId`.
  - The existing name-taken cases are ported to `presetNameHolder`.
- `pnpm exec vitest run src/__tests__/lib/db/investment-gate.test.ts`: a trashed szablon gets `TEMPLATE_TRASHED_MESSAGE`, and a trashed investment still gets `INVESTMENT_TRASHED_MESSAGE`.
- `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-presets.test.ts`:
  - „Nowy szablon” and „Zapisz jako nowy” with a trashed szablon's name return `NAME_IN_TRASH_MESSAGE`.
  - „Nadpisz” into a trashed szablon and „Wczytaj” from one return `'Nie znaleziono szablonu'`, and the persisted trees are unchanged.
  - Trashed rows in these specs are set by a raw `UPDATE investments SET trashed_at = now()`, because the action still refuses in this phase.

#### Manual Verification:

- None in this phase. Nothing can be trashed through the UI yet.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: The trash accepts a szablon

### Overview

`trashInvestmentAction` stops refusing szablony. Delete-forever requires the typed name for a szablon. Every trash action expires `presets`. `/kosz` rows carry their kind. The owner-only hard delete is removed.

### Changes Required:

#### 1. Trash actions

**File**: `src/lib/actions/investment-trash.ts`

**Intent**: A szablon goes through the same trash, restore and delete-forever path as an investment. The one difference is that delete-forever always demands the typed name, because a szablon's value is its content.

**Contract**:

- Delete the refusal at `:45-50`, and drop the now-unused import if nothing else uses it.
- In `deleteInvestmentForeverAction`, the name is required when `investment.status === TEMPLATE_INVESTMENT_STATUS || await isKosztorysUsed(…)`. Check status first so a szablon skips the query.
- Make the mismatch message kind-neutral: `'Wpisana nazwa się nie zgadza.'`.

#### 2. Tags

**File**: `src/lib/cache/tags.ts`

**Intent**: Trash, restore, delete-forever and the purge must expire the cached szablon library (`getPresets` / `getPresetSections`). The actions can't choose tags per kind (see Key Discoveries), so the shared set carries both.

**Contract**:

- `INVESTMENT_TRASH_TAGS = ['investments', 'presets']`. `INVESTMENT_DELETE_TAGS` and `purgeTrash` inherit it.
- Update the comment: moving an investment or a szablon in or out of the trash changes which rows the investment readers and the szablon library return.

#### 3. Row kind on `/kosz`

**File**: `src/lib/db/investment-trash.ts`

**Intent**: The page must split rows into two sections, and the dialog must know a szablon needs the typed name.

**Contract**:

- `TrashedInvestmentRowT` gains `isTemplate: boolean`.
- `fetchTrashedInvestments` selects `i.status = ${TEMPLATE_INVESTMENT_STATUS} AS is_template`.
- `selectPurgeableInvestmentIds` is unchanged: a szablon's `used` is false, so it purges after 30 days.

#### 4. Remove the hard delete

**File**: `src/lib/actions/kosztorys-presets.ts`

**Intent**: The only way a szablon leaves /szablony is the trash, and only the trash path can destroy one.

**Contract**:

- Delete `deletePresetAction`.
- Reword `OWNER_ONLY_PRESET_MESSAGE` to `'Tylko właściciel lub administrator może zmieniać nazwy szablonów.'`, and update its comment: rename is the one owner-only szablon power, because the name is the szablon's identity.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/actions/investment-trash.db.test.ts`:
  - „refuses a szablon” is replaced by: a MANAGER trashes and restores a szablon, and it keeps its status, name and tree.
  - Delete-forever of a trashed szablon is refused without the name and with a wrong one. With the exact name it succeeds, and the cascade removes its sections, items and snapshots. This assertion moves here from `kosztorys-presets.test.ts`.
- `pnpm exec vitest run src/__tests__/lib/db/investment-trash.db.test.ts`: `fetchTrashedInvestments` flags a szablon row `isTemplate: true` and an investment `false`. `selectPurgeableInvestmentIds` lists a szablon past retention as purgeable.
- `pnpm exec vitest run src/__tests__/lib/investments/purge-trash.db.test.ts`: a szablon past retention is purged.
- `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-presets.test.ts`: the two `deletePresetAction` cases are removed, and the rest still pass. The Phase-1 raw-SQL trashing can switch to `trashInvestmentAction` now that it accepts szablony.

#### Manual Verification:

- None beyond Phase 3. The UI still calls the removed action until Phase 3, so land Phases 2 and 3 in one push.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: /szablony and /kosz, plus docs

### Overview

The user trashes a szablon from its row on /szablony and finds it under „Szablony” on `/kosz`. The dialog and toasts speak about a szablon. The docs no longer say a szablon never goes to the trash.

### Changes Required:

#### 1. /szablony row action

**File**: `src/components/presets/preset-row-actions.tsx`

**Intent**: „Usuń” becomes a reversible move to the trash, mirroring `trash-investment-button.tsx`.

**Contract**:

- Call `trashInvestmentAction(preset.id)`.
- Relabel the `DeleteButton` to „Przenieś szablon do kosza”.
- `ConfirmDialog` with `variant="neutral"`:
  - title „Przenieść szablon do kosza?”
  - description `„${name}" zniknie z listy szablonów i z wyboru szablonu. Możesz go przywrócić z Kosza. Kosztorysy założone z tego szablonu zostają bez zmian — mają własną kopię.`
  - confirm label „Przenieś do kosza”
- Success toast „Szablon przeniesiony do kosza.”. No `router.refresh()`: the action's `updateTag` on `presets` re-renders the route.

#### 2. /kosz sections

**File**: `src/app/(frontend)/kosz/page.tsx`, `src/components/trash/trashed-investments-list.tsx` (rename to a generic section component), new `src/components/trash/trash-contents.tsx`

**Intent**: One section per kind (umbrella § 7), hidden when empty, with one page-level empty state. Flota, Sprzęt, Kasy and Pracownicy will reuse this shape.

**Contract**:

- `TrashContents({ rows: TrashedInvestmentT[] })` partitions on `isTemplate`. It renders „Inwestycje” then „Szablony” as `TrashSection({ title, rows })`, each only when non-empty. It renders `EmptyState title="Kosz jest pusty"` only when both are empty.
- `TrashSection` is the current list minus its empty branch, with the heading from `title`.
- `fateOf` is unchanged.
- The page renders `<TrashContents rows={await getTrashedInvestments()} />`.

#### 3. Kind-aware dialog and toasts

**File**: `src/components/trash/delete-forever-dialog.tsx`, `src/components/trash/trashed-investment-actions.tsx`

**Intent**: A szablon's delete-forever always asks for the name, and the text lists what a szablon actually loses.

**Contract**:

- The dialog's `investment` prop gains `isTemplate`. The name is required when `isKosztorysUsed || isTemplate`.
- For a szablon:
  - `LOST` = „sekcje, pozycje i wersje szablonu”
  - description „Zniknie bezpowrotnie: … Kosztorysy założone z tego szablonu zostają bez zmian. Wpisz nazwę „…”, żeby potwierdzić.”
  - input `aria-label` „Nazwa szablonu”
  - toast „Szablon usunięty na zawsze.”
- In `trashed-investment-actions.tsx`, the restore toast reads „Szablon przywrócony.” for a szablon.
- EX-908 is removing `router.refresh()` from both files. Keep those calls as they are and edit only the text branches, so the two changes merge cleanly.

#### 4. Docs

**File**: `context/reference/kosztorys-editor-domain-notes.md`, `context/foundation/test-plan.md`, `context/changes/2026-09-29-kosz-pozostalych-encji/research.md`

**Intent**: The living docs stop saying a szablon never goes to the trash, and the new risk is anchored.

**Contract**:

- Domain notes :1620-1622: replace „Szablon nie trafia do kosza…” with the new rule:
  - a szablon goes to the trash;
  - it vanishes from the list and every picker;
  - the name stays taken while it sits there;
  - „Usuń na zawsze” always asks for the name;
  - the cron removes it after 30 days, and the cascade then takes the tree and versions.
- test-plan § 2 Risk Map: add a row for "a trashed entity leaks back into a list or picker, or a restore loses its content". Anchor it on EX-914 and point at `presets.test.ts` and `investment-trash.db.test.ts`.
- Umbrella research § 8, row 1: mark it planned under `kosz-szablonow`.
- `test-plan.md` has uncommitted edits from another session. Edit only the new row and commit by path.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/trash/delete-forever-dialog.test.tsx`: a szablon row asks for „Nazwa szablonu” even when `isKosztorysUsed` is false, and confirm stays disabled until the exact name is typed.
- `pnpm exec vitest run src/__tests__/components/trash/trash-contents.test.tsx` (new):
  - only „Inwestycje” when there are no szablony, and only „Szablony” when there are no investments;
  - „Kosz jest pusty” only when both are empty;
  - a szablon row is listed under „Szablony”.
- `pnpm exec vitest run src/__tests__/components/presets/preset-row-actions.test.tsx` (new): confirming the dialog calls `trashInvestmentAction` with the szablon's id. Mock the action per the `stubServerActions` rule.

#### Manual Verification:

- As a MANAGER, move a szablon to the trash from /szablony. It disappears from the list, from the new-investment szablon picker, from „Wczytaj szablon” and from „Dodaj sekcje z szablonu”, and `/szablony/<id>` 404s.
- `/kosz` shows it under „Szablony” with a 30-day countdown. „Inwestycje” is hidden when no investment is trashed.
- „Nowy szablon” with the trashed szablon's name shows „Szablon o tej nazwie jest w koszu…”.
- „Przywróć” brings it back to /szablony with its sections, items and „Wersje” intact.
- „Usuń na zawsze” asks for the name and is disabled until it matches. After confirming, the row is gone from `/kosz`.
- A kosztorys seeded earlier from that szablon is unchanged after the trash and after the delete.

**Implementation Note**: When this phase's automated verification passes, commit. `/10x-implement` aggregates the manual bullets into `context/foundation/manual-checks.md`.

---

## Testing Strategy

### Unit Tests:

- DOM: the delete-forever dialog's typed-name gate per kind, the `/kosz` section partition and empty state, and the /szablony row action wiring.

### Integration Tests:

- DB-backed, against persisted state rather than action results (AGENTS.md):
  - reader exclusion per function;
  - name-holder classification;
  - gate wording;
  - trash, restore and delete-forever of a szablon, including the cascade;
  - purge of a szablon past retention;
  - the refusals of overwrite and reload against a trashed szablon.

### Manual Testing Steps:

See Phase 3 Manual Verification.

## Performance Considerations

None. The `presets` expiry is now added to every investment trash and restore, which are rare owner actions. `getPresets` and `getPresetSections` recompute once afterwards.

## Migration Notes

No schema change. There is no data to backfill: no szablon has `trashed_at` set before deploy.

## Whole-tree Gate

Run once, after Phase 3:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (serialized by `with-test-lock`)

## References

- Research: `context/changes/2026-09-29-kosz-szablonow/research.md`
- Umbrella: `context/changes/2026-09-29-kosz-pozostalych-encji/research.md` § 1, § 7, § 8
- Pattern to mirror: `src/components/investments/trash-investment-button.tsx`
- Trash design rationale: `context/foundation/lessons.md:2216-2231`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Hide a trashed szablon everywhere it is read

#### Automated

- [x] 1.1 presets.test.ts — trashed szablon excluded from every reader; presetNameHolder classification — 87eab3f4
- [x] 1.2 investment-gate.test.ts — TEMPLATE_TRASHED_MESSAGE for a trashed szablon — 87eab3f4
- [x] 1.3 kosztorys-presets.test.ts — name-in-trash refusals; overwrite/reload refuse a trashed szablon — 87eab3f4

### Phase 2: The trash accepts a szablon

#### Automated

- [x] 2.1 investment-trash.db.test.ts (actions) — szablon trash/restore by MANAGER; typed-name delete-forever with cascade — 97a4377c
- [x] 2.2 investment-trash.db.test.ts (db) — isTemplate flag; szablon purgeable past retention — 97a4377c
- [x] 2.3 purge-trash.db.test.ts — szablon past retention purged — 97a4377c
- [x] 2.4 kosztorys-presets.test.ts — deletePresetAction cases removed, suite green — 97a4377c

### Phase 3: /szablony and /kosz, plus docs

#### Automated

- [x] 3.1 delete-forever-dialog.test.tsx — szablon always asks for the name
- [x] 3.2 trash-contents.test.tsx — sections per kind, page-level empty state
- [x] 3.3 preset-row-actions.test.tsx — confirm calls trashInvestmentAction
