---
date: 2026-09-29T12:47:35+02:00
researcher: Claude (Opus 5.5)
git_commit: 05c15957
branch: catalogue-filters-and-usage
repository: wykonczymy
topic: 'Szablony kosztorysów go to the trash (/kosz) instead of a hard delete (EX-914)'
tags: [research, codebase, kosz, szablony, presets, investment-trash, cache]
status: complete
last_updated: 2026-09-29
last_updated_by: Claude (Opus 5.5)
---

# Research: Szablony kosztorysów go to the trash instead of a hard delete

**Date**: 2026-09-29T12:47:35+02:00
**Git Commit**: 05c15957
**Branch**: catalogue-filters-and-usage
**Repository**: wykonczymy

## Research Question

What does moving a szablon kosztorysu into `/kosz` (instead of the hard delete behind „Usuń szablon”) require? The owner has already decided that the trash is for mistaken/never-used entries and that MANAGER has full parity (`../2026-09-29-kosz-pozostalych-encji/change.md`). Umbrella research: `../2026-09-29-kosz-pozostalych-encji/research.md` § 1, § 3, § 7.

## Summary

- **The trash machinery is nearly ready.** A szablon is an `investments` row (`status = 'szablon'`) since EX-893. The only status check anywhere in the trash path is the refusal at `src/lib/actions/investment-trash.ts:45-50`. Restore, delete-forever, the blocker and the purge key on `trashed_at` alone. The write gate (`lockMessageOf`, `src/lib/db/investment-gate.ts:31-35`) already refuses writes to a trashed row of any status.
- **The real work is the readers.** No reader in `src/lib/db/presets.ts` filters `trashed_at`. Without that filter a trashed szablon stays in the /szablony list and in every picker. A new investment or lead can still be seeded from it, and it remains a target for „Nadpisz”, „Wczytaj szablon” and „Dodaj sekcje”. Its `/szablony/[id]` page and crumb keep rendering.
- **Removing the refusal alone gives a bad default.** The trashed szablon would show on `/kosz` under „Inwestycje” with no marker. `KOSZTORYS_USED` is always false for a szablon, because quantities are stripped and the editor has no Przedmiar column. So delete-forever would be one click, and the cron would purge the szablon after 30 days.
- **„Never a template” was never a domain rule.** It protected the old single warsztat #151, which no longer exists. EX-893 kept the hard delete only as out of scope. No szablon is special, so none needs protection from the trash.
- **Three owner decisions remain:** the purge/typed-name rule, name uniqueness vs a trashed szablon, and a `/kosz` section vs a marker. The plan also has to settle cache tags and ordering with EX-909.

## Detailed Findings

### 1. Trash machinery vs a szablon

- **The refusal** is at `src/lib/actions/investment-trash.ts:45-50` („Szablonu nie przenosi się do kosza — usuń go z listy szablonów.”). It is the only status check. The spec `src/__tests__/lib/actions/investment-trash.db.test.ts:111-121` („refuses a szablon”) asserts it and must invert.
- **Restore** is `investment-trash.ts:74-90` and **delete forever** is `:96-123`, plus `src/lib/investments/delete-investment-forever.ts:18-48`. Neither checks status.
- **Delete blocker** (`src/lib/investments/delete-blocker.ts:6-16`) counts live transactions only. On the server nothing stops a transfer on a szablon; only the pickers exclude szablony (`src/lib/queries/reference-data.ts:73`). In practice this never happens: local szablony 164 and 165 have 0 transactions.
- **Roles.** All three trash actions are `protectedAction`, which means `MANAGEMENT_ROLES` (`src/lib/actions/run-action.ts:50`), so MANAGER parity comes for free.
  - Today's `deletePresetAction` (`src/lib/actions/kosztorys-presets.ts:140-161`) is `ownerOnlyAction` (`src/lib/actions/owner-only-action.ts:12-30`, ADMIN/OWNER).
  - Delete was owner-only _because it was irreversible_. The szablony-crud change says: „nadpisanie zostawia snapshot ochronny…, a usunięcie nie zostawia niczego”. The trash removes that premise.
  - Rename stays owner-only (`:165-179`). `OWNER_ONLY_PRESET_MESSAGE` (`:133-134`, „…usuwać i przemianowywać…”) and the comment at `:131-132` must drop „usuwać”.
- **Wording that assumes an investment:**
  - `MISSING_MESSAGE` `investment-trash.ts:20`
  - the typed-name error `:115`
  - `NOT_TRASHED_MESSAGE` `delete-investment-forever.ts:5,46`
  - the gate refusal `INVESTMENT_TRASHED_MESSAGE` `src/lib/constants/investment-lock.ts:9` („Inwestycja jest w koszu…”). `investmentGateFor` already knows `isTemplate` (`investment-gate.ts:47,86`), so it can word the refusal for a szablon.
- **Status is untouched.** Trash and restore write only `trashedAt` (`investment-trash.ts:58-64,78-84`). `guardTemplateStatus` (`src/hooks/investments/guard-template-status.ts:17-30`) throws only when `data.status` changes the kind, so it lets them through.

### 2. The "used" rule, typed name and purge for a szablon

- `KOSZTORYS_USED` (`src/lib/db/investment-trash.ts:10-20`) means a non-zero Przedmiar, or etap progress with a non-zero done quantity. For a szablon it is **always false**:
  - `serializeKosztorysAsPreset` zeroes `plannedQty` and empties stages/progress (`src/lib/kosztorys/serialize-preset.ts:23-36`).
  - The szablon editor's column set (`WORKSHOP_VISIBLE_COLUMNS`, `src/lib/kosztorys/workshop-columns.ts:28-36`) has no quantity column, and adding an etap is hidden (`kosztorys-add-menu.tsx:88`).
  - Local DB: 310 items per szablon, 0 with a non-zero Przedmiar.
- `fetchTrashedInvestments` (`investment-trash.ts:29-42`) and `selectPurgeableInvestmentIds` (`:51-65`) do not filter by status. With no other change a trashed szablon:
  - is listed under „Inwestycje”;
  - shows `fateOf` = „usunie się samo za N dni” (`src/components/trash/trashed-investments-list.tsx:7-11`);
  - is purged by the cron after `TRASH_RETENTION_DAYS` (30);
  - is deletable forever with a plain confirmation.
- "Used" is the wrong concept here: a szablon's value is its 300+ priced pozycje, not job progress. This is **Open Question 1**.

### 3. Szablon readers — must add `trashed_at IS NULL`

All in `src/lib/db/presets.ts`. None filters `trashed_at` today.

| Function                   | Lines    | Reached from                                                                                                                                                                                                                                                                                                                                                               | Leak if trashed                                                                       |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `listPresets`              | :132-148 | `getPresets` (`src/lib/queries/presets.ts:20`, cached, tag `presets`), which feeds the /szablony list (`getPresetRows` :49 → `szablony/page.tsx:12`), the new-investment picker (`inwestycje/page.tsx:15` → `add-investment-dialog.tsx`), and the „Zapisz jako szablon” / „Wczytaj szablon” pickers (`src/lib/queries/preset-pickers.ts:13` → `save-preset-action.tsx:24`) | listed and pickable everywhere                                                        |
| `listPresetSections`       | :108-130 | `getPresetSections` (`queries/presets.ts:32`, cached), which feeds the /szablony counts and `getPresetSectionOptions` (`preset-pickers.ts:22`) → `use-preset-sections.ts` → „Dodaj sekcje z szablonu” and „Wczytaj szablon” dialogs                                                                                                                                        | its sections still offered                                                            |
| `getPresetName`            | :39-45   | `getTemplateView` (`queries/presets.ts:71`) → `szablony/[id]/page.tsx:19`; `getPresetNameForCrumb` (:79) → `nav/template-crumb.tsx:13`; `reloadInvestmentFromPreset` (`src/lib/kosztorys/reload-from-preset.ts:24`)                                                                                                                                                        | page renders instead of 404, crumb shows its name, reload copies from it by id        |
| `isTemplateInvestment`     | :32-37   | `seedInvestmentFromPreset` (`src/lib/kosztorys/seed-from-preset.ts:24`, from `create-investment.ts:39` and `promote-lead.ts:47`); overwrite in `savePresetAction` (`kosztorys-presets.ts:89`); `deletePresetAction` (:148)                                                                                                                                                 | new investments seeded from it; „Nadpisz” writes into it                              |
| `templateOwnersOfSections` | :83-99   | `appendPresetSectionsAction` (`kosztorys-presets.ts:203`)                                                                                                                                                                                                                                                                                                                  | a stale picker appends its sections by id                                             |
| `renamePreset`             | :68-79   | `renamePresetAction` (`:165-179`)                                                                                                                                                                                                                                                                                                                                          | a trashed szablon can be renamed, because it is a raw `UPDATE` that bypasses the gate |

`isTemplateInvestment` has callers that want different answers. Seed and overwrite need "live szablon". The trash entry point needs "is a szablon" so that trashing an already-trashed one is idempotent, or it needs a clear refusal.

Already covered:

- `reference-data.ts:73`, `src/lib/db/catalogue-usage.ts:16` and `src/lib/db/snapshots.ts:79-86` exclude szablony and trashed rows alike.
- `listSnapshotsAction` (`kosztorys-snapshots.ts:108`) is read-only and deliberately ungated.

### 4. Write paths

| Path                                                                         | Gated by `investmentGateFor`?   | Trashed szablon                      |
| ---------------------------------------------------------------------------- | ------------------------------- | ------------------------------------ |
| Editor cell, section and item writes (`investmentAction`)                    | yes                             | refused                              |
| Snapshot save/restore (`src/lib/actions/kosztorys-snapshots.ts:18,30,70`)    | yes                             | refused                              |
| Append-sections / reload **into** a szablon (`kosztorys-presets.ts:192,238`) | yes, on the target              | refused; as a _source_ see § 3       |
| **`savePresetAction` overwrite** (`:85-103`)                                 | no, only `isTemplateInvestment` | **written**, fixed by the § 3 filter |
| **`renamePresetAction`** (`presets.ts:68-79`)                                | no                              | **renamed**, fixed by the § 3 filter |
| `createTemplate` (`src/lib/kosztorys/create-template.ts:15-30`)              | new row                         | n/a, see § 5                         |

### 5. Name uniqueness vs a trashed szablon

- Two things enforce the name:
  - the partial unique index `investments_szablon_name_idx` on `lower(trim(name)) WHERE status = 'szablon'` (`src/migrations/20260929_1_szablon_as_investment.ts:113-116`);
  - the app-level `SAME_NAME` (`presets.ts:49`), used in `isPresetNameTaken` (:56-60) and in `renamePreset`'s `NOT EXISTS` (:72-75).
- Neither sees `trashed_at`, so the trashed szablon keeps its name. Creating („Nowy szablon” `createEmptyPresetAction` :111, „Zapisz jako nowy” :71) or renaming to that name returns „Szablon o tej nazwie już istnieje” (`kosztorys-presets.ts:36`, returned at :81, :123, :174) for a szablon the user can't see.
- **Option A — keep the index, name the holder.** Report whether the collision is with a trashed szablon, e.g. „Szablon o tej nazwie jest w koszu — przywróć go lub usuń na zawsze.” Restore can never collide, and no migration is needed.
- **Option B — free the name.** Add `AND trashed_at IS NULL` to the index (a hand-written migration) and to `SAME_NAME`. Restore then becomes the collision point. `restoreInvestmentAction` does a bare `payload.update`, so a 23505 falls through `toActionFailure` (`src/lib/actions/action-failure.ts:17`) and the toast shows the driver's English message. Restore would need a Polish pre-check that applies only to szablony.
- This is **Open Question 2**.

### 6. `/kosz` UI

- The page (`src/app/(frontend)/kosz/page.tsx:10-14`) renders one `TrashedInvestmentsList`. Its `h2` „Inwestycje” is at `:16` and „Kosz jest pusty” at `:17-18`. Despite the wording, that empty state belongs to the section, not the page.
- Text that is wrong for a szablon:
  - `delete-forever-dialog.tsx`: `LOST` :17 („kosztorys (pozycje i wersje), przypięcia zdjęć, link dla inwestora”), :44, :59 („Kosztorys tej inwestycji jest w użyciu”), :70 (`aria-label`), and the toasts :32-33.
  - `trashed-investment-actions.tsx`: toasts :21-22.
- To split per kind, `TrashedInvestmentRowT` (`src/lib/db/investment-trash.ts:22-27`) needs `status`/`isTemplate` selected at `:31`, and `getTrashedInvestments` (`src/lib/queries/trash.ts:18-33`) has to pass it through.
- **Section vs marker** is **Open Question 3**. A separate „Szablony” `<h2>` matches umbrella § 7 (one section per kind, and a page-level empty state only when every section is empty). A marker is cheaper now, but the dialog, `fateOf` and toasts would still have to branch per row.

### 7. Cache

- Szablon readers are cached only under `CACHE_TAGS.presets`: `getPresets` and `getPresetSections` (`src/lib/queries/presets.ts:20-40`).
- `getTemplateView` and `getPresetNameForCrumb` (`:71-87`) and the kosztorys tree are uncached.
- `INVESTMENT_TRASH_TAGS = ['investments']` (`src/lib/cache/tags.ts:64-66`) doesn't cover szablony, so trash and restore must also expire `presets`. The same is true of `INVESTMENT_DELETE_TAGS` (`:71-77`) for delete-forever: the list is already filtered by then, but section counts and pickers are cached.
- **Constraint:** `protectedAction` fixes its tag list before the handler runs (`run-action.ts:44,62`), so it can't pick tags by status. The `/kosz` restore and delete-forever buttons are shared across kinds unless the section split gives szablony their own actions. The pragmatic option is to **add `'presets'` to both tag sets**. The cost is that /szablony recomputes on a rare investment trash.
- lessons.md:1084-1098 ("same type, new source: bump the key") applies. Filtering `trashed_at` changes what `['presets']` / `['preset-sections']` return, and EX-893 already served stale entries on prod once. Bump both keys when the filter lands.

### 8. Entry point on /szablony

- `src/components/presets/preset-row-actions.tsx`: `DeleteButton label="Usuń szablon"` at :47, the dialog at :69-76 with „…zniknie bezpowrotnie, razem ze swoimi wersjami. Kosztorysy założone z tego szablonu zostają bez zmian — mają własną kopię.”, and the handler and toast at :19-26. It is wired via `src/components/tables/presets.tsx:34-39`.
- **The UI has no role gating:** a MANAGER sees Rename and Delete and is refused by the server. After this change Delete becomes valid for MANAGER, and Rename stays a visible button the server refuses. That rename quirk exists today and is out of scope.
- The dialog to mirror is `src/components/investments/trash-investment-button.tsx:31-39` (neutral variant, „Przenieść do kosza?”, „Możesz ją przywrócić z Kosza”). Keep the sentence about frozen seeded copies, since the trash doesn't touch them either.

### 9. Special szablony — none

- **The warsztat is gone.**
  - `20260929_1` turned each `kosztorys_presets` row into its own szablon investment, moving its restore points along, and dropped `investments_single_szablon_idx`.
  - `20260929_2:13-19` deleted the old workshop row and dropped the presets table and the pointer columns.
  - The remaining name `workshopVisible` / `WORKSHOP_VISIBLE_COLUMNS` is only the szablon editor's column set.
- **There is no default szablon:** `presetId` is optional (`create-investment.ts:35-36`). A missing szablon only produces a warning toast.
- **The katalog seed from a „szablon-wzór” (23bf2fc9) is deleted.** `src/scripts/seed-work-catalogue.ts` is now an E2E fixture that reads no szablon.

## Code References

- `src/lib/actions/investment-trash.ts:45-50`: the szablon refusal to remove
- `src/lib/actions/investment-trash.ts:20,115`, `src/lib/investments/delete-investment-forever.ts:5,46`, `src/lib/constants/investment-lock.ts:9`: investment-worded messages
- `src/lib/db/investment-trash.ts:10-20,22-27,29-42,51-65`: `KOSZTORYS_USED`, row type, listing, purge selection
- `src/lib/db/presets.ts:32-148`: every szablon reader and the name checks
- `src/lib/actions/kosztorys-presets.ts:36,85-103,131-179`: name-taken message, overwrite, owner-only delete and rename
- `src/lib/queries/presets.ts:20-87`, `src/lib/queries/preset-pickers.ts:13-27`: cached reads and the page/crumb reads
- `src/lib/cache/tags.ts:64-77`: `INVESTMENT_TRASH_TAGS`, `INVESTMENT_DELETE_TAGS`
- `src/migrations/20260929_1_szablon_as_investment.ts:113-116`: unique name index
- `src/components/presets/preset-row-actions.tsx:19-26,47,69-76`: entry point
- `src/app/(frontend)/kosz/page.tsx:10-14`, `src/components/trash/{trashed-investments-list,trashed-investment-actions,delete-forever-dialog}.tsx`: /kosz UI
- `src/lib/kosztorys/serialize-preset.ts:23-36`, `src/lib/kosztorys/workshop-columns.ts:28-36`: why a szablon is never "used"

## Architecture Insights

- **One row type, two kinds.** Because a szablon is an investment row, the hand-rolled `trashed_at` model is reused as is: no new column, no new purge step, the same gate. What doesn't carry over is the _reader chokepoint_. Investments hide trashed rows at `fetchReferenceData`, but szablony have their own reader set in `presets.ts`, so a second chokepoint has to be filtered. This is the fail-open trade-off lessons.md:2216-2231 accepted: a forgotten filter leaks a row, it does not throw.
- **Tags are chosen at the edge.** Because `protectedAction` fixes its tag list before the handler runs, a mixed-kind action pays for the union of both kinds' tags. That is acceptable here because trashing is rare.
- **A rule rooted in irreversibility dissolves with the trash.** Owner-only delete was justified by "usunięcie nie zostawia niczego". Move-to-trash inherits MANAGEMENT_ROLES, which matches the owner's parity decision. Rename's owner-only rule rests on something else and stays.

## Historical Context (from prior changes)

- `context/archive/2026-09-24-kosz-inwestycji/change.md:29`: „Never a template”. The pre-archive plan-brief shows the reason was the **warsztat #151** („It is not an investment”; refusal „Warsztatu szablonów nie można usunąć.”). At that date status `szablon` meant exactly that one shared row.
- EX-893 `warsztat-per-szablon` (done; commits 5e26b9d1, 026f6912, 6e427028, d7b0953a, b957cb51, 4648b15a; archive removed in 91c92537, recover with `git show 91c92537^:context/changes/2026-09-29-warsztat-per-szablon/plan.md`). Its „What We're NOT Doing” says „Kosz i wersjonowanie usunięcia szablonu. Usunięcie jest twarde, jak dziś.”, which was out of scope rather than a ruling.
- szablony-crud (2026-09-14, 4b38e077, e93977f3, 0cfcce17) is where delete and rename became owner-only, because delete was irreversible.
- `context/reference/kosztorys-editor-domain-notes.md:1620-1622`: „Szablon nie trafia do kosza…”. To be rewritten. The umbrella research cites :1607 by mistake.
- lessons.md:246-251 says a DB cascade needs its child tags expired by hand. :1084-1098 says bump the key when a result's meaning changes. :1704-1709 is the lesson from the warsztat id whose meaning drifted.

## Related Research

- `context/changes/2026-09-29-kosz-pozostalych-encji/research.md` is the umbrella. Two corrections to its § 3: the domain-notes ref is :1620-1622, not :1607, and „reverses a recorded decision” overstates the case (see Historical Context).
- `context/changes/2026-09-29-szablony-plain-revalidation/` (EX-909, preparing, no plan) moves `getTemplateView` and `getPresetNameForCrumb` onto the **cached** `getPresets()` list. After it lands, the trashed filter must live in `listPresets`, not just `getPresetName`, or EX-909 silently drops the filter. It also edits the neighbouring `createEmptyPresetAction` hunk (`kosztorys-presets.ts:111-129`) and deletes `expireCollectionsAfterResponse`, so new szablon code must use plain `protectedAction` tags.
- `context/changes/2026-09-29-redundant-router-refresh/` (EX-908, preparing) removes `router.refresh()` from `trashed-investment-actions.tsx:23` and `delete-forever-dialog.tsx:35`, the same files § 6 reworks.
- `context/changes/2026-09-22-kosz-plikow/plan.md:84` plans a second `TRASH_RETENTION_DAYS = 7`, which collides with `investment-lock.ts:11` (30). Szablony share the 30 days and don't need a new constant.

## Tests that change

- `src/__tests__/lib/actions/investment-trash.db.test.ts:111-121`: inverts. Add szablon trash, restore and delete-forever, plus a MANAGER case.
- `src/__tests__/lib/actions/kosztorys-presets.test.ts:555-573`: the cascade assertion moves to delete-forever, and the trashed row survives. `:575-585` (an ordinary investment refused via the list) stays. The auth mock is OWNER-only (:21), so add MANAGER-allowed trash and MANAGER-refused rename.
- `src/__tests__/lib/db/presets.test.ts`: "a trashed szablon is excluded" for each reader in § 3, and the name-collision cases per Open Question 2.
- `src/__tests__/lib/db/investment-trash.db.test.ts:85-104`, `src/__tests__/lib/investments/purge-trash.db.test.ts:59`: kind flag, and purge/skip per Open Question 1.
- `src/__tests__/components/trash/delete-forever-dialog.test.tsx:28,46`: if the dialog branches by kind.
- No spec exists for `preset-row-actions`, `trashed-investments-list` or `trashed-investment-actions`. `e2e/kosztorys-presets.spec.ts` doesn't cover delete. `test-plan.md` has no trash risk row (risk #13 covers szablon identity and name uniqueness), so a row needs adding.

## Open Questions

1. **Purge and typed name for a szablon.** Should a trashed szablon auto-purge after 30 days like an unused investment, and should „Usuń na zawsze” ask for the typed name?
   - _Recommendation:_ purge after 30 days (the trash is the grace window, consistent with "trash = mistakes"), **and** require the typed name, since a szablon's value is its content, not job progress. This needs a kind branch next to `KOSZTORYS_USED`, keeping the shared-fragment invariant (`investment-trash.ts:7-8`).
2. **A new szablon with a trashed szablon's name.**
   - _Recommendation:_ Option A. Keep the index and say „jest w koszu” with a pointer to /kosz. No migration, and restore can never collide.
3. **`/kosz` layout.**
   - _Recommendation:_ a separate „Szablony” section. Hide empty sections, and show „Kosz jest pusty” at page level only when all sections are empty. That is umbrella § 7's shape, which Flota/Sprzęt/Kasy/Pracownicy will reuse.
4. **Order vs EX-909.** Land EX-909 first, or put the `trashed_at` filter in `listPresets` from day one so EX-909's switch to the cached read keeps it. The second is recommended because it holds in either order.
5. **Entry points.** Either rework `deletePresetAction` into a szablon trash action with `['presets']`, or call `trashInvestmentAction` with `'presets'` added to the shared tag sets. That is the plan's choice, not the owner's. Restore and delete-forever on `/kosz` are shared either way, so the tag union is needed regardless.
