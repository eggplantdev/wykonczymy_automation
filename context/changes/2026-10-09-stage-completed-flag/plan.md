# Etap „zakończony" Flag Implementation Plan

Linear: **EX-1034**.

## Overview

A manager (and up) marks an etap as zakończony from its header menu. The flag does two things:

1. **Worker gate.** An investment stays on a worker's lists while he holds at least one open etap on
   it. Once every one of his etapy there is zakończony, the investment drops off his lists and his
   report link refuses new reports.
2. **Colour.** A zakończony etap's columns are tinted with a "finished" colour in every on-screen
   kosztorys view.

The flag locks nothing. Quantities stay editable, the manager can still accept report lines into a
zakończony etap, and the flag can be cleared again.

## Current State Analysis

- `kosztorys_stages` holds `ordinal`, `label`, `plane` and `split_mode`, and has no status column
  (`src/collections/kosztorys-stages.ts`). Workers sit in the raw table
  `kosztorys_stage_workers(stage_id, worker_id)`.
- Every UI reader of stages goes through one query, `selectKosztorysTreeData`
  (`src/lib/db/kosztorys-tree.ts:95-101` SELECT, `mapStage` :218-224), into `KosztorysStageT`
  (`src/lib/kosztorys/types.ts:151-158`). That covers the editor, the investor preview, `/k/[token]`,
  the worker view, PDFs, history and accept.
- **Worker lists.** `listWorkerStageInvestments` and `listWorkersWithActiveStages`
  (`src/lib/db/stage-memberships.ts`) feed:
  - the worker's own `/pracownicy/[id]`: report links, „Moje inwestycje", and the quick actions;
  - the expense/FV draft picker and its server check (`findDraftTargetError`,
    `src/lib/actions/worker-expense-drafts.ts:57-71`);
  - the global scan dialog (worker picker + investment step).

  Both lists filter on `i.status = 'active'` only.
- **A worker report names no etap.** The worker sends `{itemId, qty}` lines for the whole investment.
  The manager picks the etap at acceptance (`resolveTarget`, `src/lib/actions/accept-worker-report.ts:339-364`).
  So "no reporting onto a zakończony etap" can only be enforced at scope level: *does the worker still
  hold an open etap here?*
- **Scope.** `resolveWorkerScope` (`src/lib/kosztorys/worker-view/scope.ts`) decides which etapy a
  worker's view shows, and is read by six callers: the report page, `tokenAction` (send), the scan
  action, the editor's „Pracownicy" menu, the accept dialog and the accept action. Its `stages` list
  also drives his settlement view, so zakończone etapy must stay **in** it (they render tinted). The
  "may report" question is therefore a separate check, not a filter on the scope.
- **Report page.** `getWorkerReportPage` (`src/lib/queries/worker-report-page.ts:37-59`) turns refusals
  into a notice page using `REPORT_REFUSALS` (`src/lib/kosztorys/worker-report/refusals.ts`). The
  manager's „Podgląd pracownika" (`getWorkerReportPreview`) shares `assembleReportPage` but reads no
  share.
- **Colour.** One builder renders all on-screen views: `assembleV2Columns` → `selectV2Columns`
  (`src/components/kosztorys/editor/grid/column-selection.ts:148-150`), which applies `withColumnColor`
  (`grid/column-color.ts`). That helper uses the class `kosztorys-column-tint` with `--column-tint`, a
  `background-image` overlay (`src/styles/globals.css:753-758`). The preview stripe rule
  (`globals.css:653-655`) is a `background` shorthand at higher specificity, so it **resets that
  image** on every odd column of the investor and worker views. The read-only `StageHeader` branch
  (`grid/stage-header.tsx:89-95`) renders a bare label.
- **Stage mutation.** `updateStageAction` (`src/lib/actions/kosztorys.ts:800-815`, `investmentAction`
  → `MANAGEMENT_ROLES`, gate `{kind:'stage', id}`, tag `kosztorysStages`), plus the editor's optimistic
  `patchStageField` (`editor/hooks/use-kosztorys-stage-ops.ts:93-115`).

## Desired End State

- **Toggle.** The etap header menu in the editor has a „Etap zakończony" checkbox. Toggling it saves
  optimistically and survives a reload, a snapshot restore and an import „Zastąp".
- **Lists.** A worker whose every etap on investment X is zakończony no longer sees X:
  - on his page (report link, „Moje inwestycje", „Zgłoś pracę");
  - in the new-expense picker;
  - in the global scan dialog.

  He still sees X while one of his etapy there is open. Reopening an etap brings X back.
- **Report link.** His bookmarked report link for X shows a „your etapy here are finished" notice
  instead of the form, and a send from a page opened earlier is refused with the same sentence.
  The kierownik's scan for him on X is refused, and the editor's scan menu item for him is disabled.
- **Unchanged.**
  - The manager accepts any pending report into any etap, zakończone included.
  - „Podgląd pracownika" still renders his view.
- **Drafts.** A pending expense draft on X can still be edited without moving it. Its own investment
  stays valid and listed in the edit picker.
- **Colour.** A zakończony etap's quantity, per-etap netto and per-etap brutto columns are tinted
  green, with a ✓ in the header, in:
  - the editor;
  - podgląd inwestora and `/k/[token]`;
  - podgląd pracownika and `/z/...`.

  The tint shows on striped columns too. PDFs are unchanged.

### Key Discoveries:

- Adding a stage field is not done until the raw restore INSERT carries it (`lessons.md` §"Adding a
  field to a kosztorys tree entity…"). `insert-schema-drift.test.ts` fails until `completed` is in
  `STAGE_INSERT_COLUMNS` (`src/lib/kosztorys/insert-kosztorys-tree.ts:15-21`).
- `StoredStageT` (`snapshot-format.ts:139`): old snapshots have no key. The field goes in as optional
  with `?? false` on read, and there is no `SNAPSHOT_SCHEMA_VERSION` bump (additive).
- `history/snapshot-to-tree.ts:36-42` picks stage fields one by one, so it must add `completed`.
- Hand-built stage literals need `completed: false`:
  - `stage-split.ts:74` (`insertWorkerStage`);
  - `use-kosztorys-stage-ops.ts:59` (`handleAddStage`);
  - `sheet-import/parse-labor-tab.ts:227-237`;
  - `sheet-import/build-import-plan.ts:264`.
- `tokenAction` has exactly one caller (`sendWorkerReportAction`), so a refusal there is a refusal of
  the send only.
- `createScannedReportAction` (`src/lib/actions/worker-report-scan.ts:33-80`) and the editor scan entry
  (`kosztorys-workers-menu.tsx` via `assignedWorkers` → `resolveWorkerScope`) are the other ways into
  the report flow.
- Dictionaries: `src/lib/i18n/dictionaries/{pl,uk,ru}.ts`. A new notice key needs all three.

## What We're NOT Doing

- No lock: zakończony etapy stay editable (quantities, split, plane, rename, delete).
- No restriction at acceptance. The accept picker and `resolveTarget` are untouched, and no
  `completed_at` timestamp is kept.
- No PDF change (investor offer print, worker print).
- No per-item hiding in the report form. Items aren't etap-bound.
- No change to „Podgląd pracownika" gating, to `resolveWorkerScope`'s view semantics, or to settlement
  figures.
- No new investment status. This is etap-level only.

## Implementation Approach

1. **Data and toggle first**, so every later phase reads a real column.
2. **Worker gates**: one pure predicate, "does this worker still hold an open etap", lives next to
   `resolveWorkerScope`, and every report-flow entry reads it. The two list queries carry the same
   rule in SQL (`ks.completed = false` on the joined etap). They stay the single source for "which
   investments a worker sees".
3. **Colour**: a second column wrapper next to `withColumnColor`, keyed on the stage ids that are
   zakończone, reusing the same `--column-tint` overlay. One CSS fix stops the preview stripe from
   erasing it.

## Critical Implementation Details

- **Tint precedence.** The finished-tint wrapper runs **after** `withColumnColor` in
  `selectV2Columns`, so on a zakończony etap's column it overrides a user-picked column colour; the
  status must win over a cosmetic preference. The section band rows keep winning over both, because
  their `background` shorthand resets the image, as today.
- **Stripe fix.** Change the preview stripe rule from the `background` shorthand to
  `background-color`, so it stops resetting `background-image`. The comment says the band has to win
  over the stripe, and the band rule still uses the shorthand, so that ordering holds. Re-check the
  `kosztorys-report-column` rule right after it, which restates the shorthand on purpose.
- **Investment-list SQL.** `DISTINCT` over the join already collapses multiple etapy, so filter the
  joined etap with `AND ks.completed = false`. An investment survives if any of his rows survives,
  which is exactly the per-worker rule.

## Phase 1: Flag + toggle

### Overview

Persist the flag, carry it through every read and write path of the tree, and let manager+ toggle
it from the etap menu.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/<next>_kosztorys_stages_completed.ts`, plus registration in
`src/migrations/index.ts`.

**Intent**: Add the column. Hand-written, following the `20261002_1_investments_review_requested.ts`
precedent. Take the next free name at implement time (`git status src/migrations` first). Today that
is `20261009_4_…`, or `20261010_1_…` on a later date.

**Contract**: `ALTER TABLE "kosztorys_stages" ADD COLUMN IF NOT EXISTS "completed" boolean NOT NULL DEFAULT false;`
The `down` migration drops the column. It is additive, so prod is migrated **before** the push
(human, `pnpm db:migrate:prod`).

#### 2. Collection + type + read path

**Files**:
- `src/collections/kosztorys-stages.ts`
- `src/lib/kosztorys/types.ts`
- `src/lib/db/kosztorys-tree.ts`

**Intent**: Make the flag a first-class stage field.

**Contract**:
- Collection field: `{ name: 'completed', type: 'checkbox', defaultValue: false, label: { en: 'Completed', pl: 'Zakończony' } }`.
- `KosztorysStageT.completed: boolean`. It is **required**, so every builder of a stage has to decide
  its value; typecheck lists them.
- The stages subselect adds `completed`, and `mapStage` maps it. `kosztorys-tree-sql-drift.test.ts`
  guards that pairing.
- Run `pnpm generate:types` (the output is gitignored).

#### 3. Raw write paths + literals

**Files**:
- `src/lib/kosztorys/insert-kosztorys-tree.ts`
- `src/lib/kosztorys/snapshot-format.ts`
- `src/lib/kosztorys/history/snapshot-to-tree.ts`
- `src/lib/db/stage-split.ts`
- `editor/hooks/use-kosztorys-stage-ops.ts`
- `sheet-import/parse-labor-tab.ts`
- `sheet-import/build-import-plan.ts`
- test fixtures flagged by `tsc`

**Intent**: Restore, import, history and freshly created etapy all keep or initialise the flag.

**Contract**:
- `completed` is added to `STAGE_INSERT_COLUMNS` and the VALUES tuple, as `s.completed ?? false`.
- `StoredStageT.completed?: boolean`, with no schema-version bump.
- New etapy and imported etapy start as `completed: false`.
- Test fixture builders (e.g. `src/__tests__/helpers/kosztorys-history.ts` `stage()`, the row-condition
  fixtures) default it to `false` in the helper, not at each call site, where a helper exists.
- `src/__tests__/helpers/kosztorys-db-tree.ts` gets a per-stage `completed` option for the DB specs in
  Phase 2.

#### 4. Action + editor toggle

**Files**:
- `src/lib/actions/kosztorys.ts` (`stagePatchSchema`, `updateStageAction`)
- `src/lib/kosztorys/types.ts` (`StagePatchT`)
- `editor/hooks/use-kosztorys-stage-ops.ts`
- `editor/grid/kosztorys-v2-column-opts.ts`
- `editor/grid/kosztorys-v2-columns.tsx`
- `editor/use-kosztorys-editor.ts`
- `editor/grid/stage-header.tsx`
- `editor/grid/stage-header-copy.ts`

**Intent**: Reuse the „Rozliczenie" save path end to end. Nothing new beyond one patch key and one
menu row.

**Contract**:
- `stagePatchSchema` and `StagePatchT` gain `completed: boolean`.
- `handleSetStageCompleted(id, value)` = `patchStageField(id, 'completed', value, 'stage-completed')`.
- New column opt `onSetStageCompleted`, wired through `editorOnly(...)`. It is threaded into
  `StageHeader` and included in its "no handlers = read-only" check.
- The menu gets a `DropdownMenuCheckboxRow` „Etap zakończony" (copy in `STAGE_HEADER_COPY`), placed
  after the Rozliczenie group.

### Success Criteria:

#### Automated Verification:

- Migration applies to the local DB: `pnpm payload migrate` (after `git status src/migrations`)
- `pnpm exec vitest run src/__tests__/lib/kosztorys/insert-schema-drift.test.ts src/__tests__/lib/db/kosztorys-tree-sql-drift.test.ts` passes
- `updateStageAction` persists `completed` and reads it back from the DB, and clearing it works:
  extend `src/__tests__/lib/actions/kosztorys-stages.test.ts`
- A snapshot taken with a zakończony etap restores it as zakończony, and an old snapshot without the
  key restores it as open. Unit/DB spec beside the existing snapshot restore specs.
- The header menu checkbox reflects `stage.completed` and calls the handler; the read-only mount
  renders no menu. DOM spec next to `stage-header-plane.test.tsx`.

#### Manual Verification:

- In the editor, toggle „Etap zakończony" on an etap → reload → still checked; uncheck → reload →
  cleared.
- Restore an older history snapshot after closing an etap: the restored etap matches the snapshot.

**Implementation Note**: When this phase's automated verification passes, commit and continue. Do
not pause for per-phase manual confirmation.

---

## Phase 2: Worker gates

### Overview

Apply the per-worker rule to both list queries, and add one "may still report" predicate that every
entry into the report flow reads.

### Changes Required:

#### 1. List queries

**File**: `src/lib/db/stage-memberships.ts`

**Intent**: An investment or worker appears only through an **open** etap.

**Contract**: `listWorkerStageInvestments` and `listWorkersWithActiveStages` add
`AND ks.completed = false`. The return shapes are unchanged. Update the comment on
`listWorkersWithActiveStages`, which promises it matches `listWorkerStageInvestments`, so it states
the shared rule.

#### 2. Report predicate + notice key

**Files**:
- `src/lib/kosztorys/worker-view/scope.ts`
- `src/lib/kosztorys/worker-report/refusals.ts`
- `src/lib/i18n/dictionaries/{pl,uk,ru}.ts`

**Intent**: One pure answer to "may this worker still report here". The view scope stays as is, so
finished etapy keep rendering in his settlement.

**Contract**:
- `hasOpenStage(scope: Extract<WorkerScopeT, {kind:'ready'}>): boolean`, true when any of
  `scope.stages` is not `completed`. The exact name is the implementer's call.
- New notice key `stagesCompleted` in `REPORT_REFUSALS` and all three dictionaries. Polish wording
  along the lines of „Twoje etapy na tej inwestycji są zakończone — nie można już zgłaszać prac."

#### 3. Enforce at every entry

**Files**:
- `src/lib/queries/worker-report-page.ts`
- `src/lib/actions/token-action.ts`
- `src/lib/actions/worker-report-scan.ts`
- `src/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.tsx` (and the scan menu item
  it renders)

**Intent**: The link page, the send, the scan action and the editor scan entry all say the same thing.

**Contract**:
- **`getWorkerReportPage` (token page only).** When the assembled page is `ready` and the worker has
  no open etap, return the `stagesCompleted` notice. `getWorkerReportPreview` is untouched, so the
  manager still previews his view.
- **`tokenAction`.** After the scope-blocked check, refuse `stagesCompleted` when there is no open etap.
- **`createScannedReportAction`.** The same refusal after its scope check.
- **Editor „Pracownicy" menu.** The scan item for a worker with no open etap is disabled, with the same
  sentence as its reason, following how a blocked scope disables it today.

#### 4. Expense-draft exception

**Files**:
- `src/lib/actions/worker-expense-drafts.ts`
- `src/components/worker-expenses/expense-draft-dialog.tsx` (and wherever the edit dialog gets its
  options)

**Intent**: A draft already sent onto an investment isn't stranded when his etapy there close. New
drafts follow the list rule.

**Contract**:
- `findDraftTargetError` takes the draft's current investment id on update (unchanged on send) and
  accepts it even when it is absent from the list.
- The edit dialog's investment options include the draft's current investment when the list lacks it.
  Use the name the draft row already carries; if it doesn't carry one, add it to the draft read.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/db/stage-memberships.test.ts`:
  - all of his etapy on an active investment zakończone → absent;
  - one open, one zakończony → present once;
  - another worker's zakończony etap does not affect him.
- `src/__tests__/lib/db/stage-memberships.db.test.ts`: a worker whose only etap is zakończony is absent
  from `listWorkersWithActiveStages`.
- `src/__tests__/lib/kosztorys/worker-view/scope.test.ts`: the predicate is true with ≥1 open etap and
  false when all are zakończone.
- `src/__tests__/lib/actions/token-action.test.ts`: a send with all etapy zakończone is refused with
  `stagesCompleted` and **no report row is stored**.
- `src/__tests__/lib/queries/worker-report-page.test.ts`:
  - the token page returns the `stagesCompleted` notice;
  - the preview still returns `ready`.
- `src/__tests__/lib/actions/worker-report-scan.db.test.ts`: the scan is refused and no report is stored.
- `src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts`:
  - a new draft onto a fully-zakończone investment → `notOnInvestment`;
  - editing an existing draft on it without moving → succeeds, and the persisted row is updated.
- `src/__tests__/lib/actions/accept-worker-report.test.ts`: accepting a pending report into a
  zakończony etap still succeeds. This guards "no restriction".

#### Manual Verification:

- As an EMPLOYEE on a phone (390px) holding one etap on investment X, close the etap as manager:
  - X disappears from „Moje inwestycje";
  - X disappears from the „Zgłoś pracę" link;
  - X disappears from the new-expense picker.

  Reopen the etap → X returns.
- Open his saved `/z/...` link after closing: the notice shows, not the form.
- With one open and one zakończony etap: X stays listed, and the link works.
- An existing pending FV draft on X stays editable after closing.
- In the editor „Pracownicy" menu, the scan entry for that worker is disabled with the reason.
- The global scan dialog no longer offers him or X.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Finished colour + docs

### Overview

Tint zakończone etapy in every on-screen view and mark their headers.

### Changes Required:

#### 1. Column wrapper

**Files**:
- `src/components/kosztorys/editor/grid/column-color.ts` (or a sibling file)
- `src/components/kosztorys/editor/grid/column-selection.ts`

**Intent**: One wrapper covers the editor, investor and worker views, because they share the builder.

**Contract**:
- `withStageCompletedTint(col, opts)` applies `kosztorys-column-tint` plus
  `[--column-tint:var(--color-section-green)]` to the cells and header of every column belonging to a
  stage with `completed`: the quantity column, `stageValueNetKey(id)` and `stageValueGrossKey(id)`.
- Map column ids → stage ids from `opts.stages`.
- It runs after `withColumnColor` in `selectV2Columns` (precedence: see Critical Implementation Details).

#### 2. Header marker

**File**: `src/components/kosztorys/editor/grid/stage-header.tsx`, and `column-headers.tsx`
(`stageValueHeader`) if its label should carry the ✓ too.

**Intent**: The colour isn't the only signal. A ✓ icon sits before the label in both the editor
trigger and the read-only branch, with the title „Etap zakończony".

**Contract**: It reads `stage.completed`. No new props are needed beyond the stage the header already
gets.

#### 3. Stripe CSS

**File**: `src/styles/globals.css`

**Intent**: The preview stripe must not erase the tint.

**Contract**: The stripe rule becomes `background-color`, and the comment about band ordering stays
true. Visually check the report column and the section bands.

#### 4. Docs

**File**: `context/reference/kosztorys-editor-domain-notes.md`

**Intent**: Record the etap „zakończony" meaning:
- per-worker list rule;
- report refusal;
- no lock and no accept restriction;
- the colour, screen only.

### Success Criteria:

#### Automated Verification:

- A unit spec for the wrapper under `src/__tests__/components/kosztorys/editor/grid/`:
  - a zakończony etap's three columns carry the tint class and the green variable;
  - an open etap's columns don't;
  - a user colour on a zakończony etap's column is overridden.
- The `stage-header` DOM spec renders the ✓ marker in both the read-only and editor mounts when
  `completed`.

#### Manual Verification:

- Editor: close an etap → its quantity, netto and brutto columns turn green, with a ✓ in the header;
  reopen → back to normal.
- Podgląd inwestora and `/k/[token]`: the same columns are green, including a striped (odd) column,
  and section band rows still read as one bar.
- Podgląd pracownika and `/z/...` (with one open + one zakończony etap): the zakończony column is green,
  and the „Zgłaszam" column keeps its lime.
- Dark mode in the editor: the tint is readable.
- An investor PDF and a worker PDF printed after closing an etap are unchanged.

**Implementation Note**: Final phase. Roll the manual bullets of all phases into
`context/foundation/manual-checks.md`.

---

## Testing Strategy

### Unit Tests:

- The open-etap predicate (scope).
- The finished-tint column wrapper, including precedence over a user colour.
- Snapshot round trip with and without the key.

### Integration Tests (DB):

- Both list queries under the per-worker rule.
- The send, scan and draft actions: refusal **and** no persisted row; draft edit allowed and persisted.
- Accept into a zakończony etap still works.
- `updateStageAction` toggle read back from the DB.

### DOM:

- The stage header menu checkbox and the ✓ marker.

### E2E:

- None authored here. The cross-boundary risk (manager closes an etap → the worker's list and link
  change) is covered by the DB specs on each side. If the gate wants a browser guard, file it to the
  `e2e-backlog`.

## Performance Considerations

None. The new list predicate rides the existing join, and the tint is a class per column.

## Migration Notes

The migration is additive (`NOT NULL DEFAULT false`), so every existing etap starts open. Migrate
prod (`pnpm db:migrate:prod`, by a human) **before** pushing the code that selects the column.

## Whole-tree Gate

Run once, after the final phase:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (the full unit/DOM suite, only when asked)
- `pnpm test:integration`

## References

- Change notes: `context/changes/2026-10-09-stage-completed-flag/change.md`
- Template action/hook: `src/lib/actions/kosztorys.ts:800-815`, `editor/hooks/use-kosztorys-stage-ops.ts:93-130`
- Boolean column precedent: `src/migrations/20261002_1_investments_review_requested.ts`
- Column tint mechanism: `grid/column-color.ts`, `globals.css:753-758`
- Lessons: "Adding a field to a kosztorys tree entity…", "Migration filenames sort lexically…"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Flag + toggle

#### Automated

- [x] 1.1 Migration applies to the local DB
- [x] 1.2 insert-schema-drift + kosztorys-tree-sql-drift specs pass
- [x] 1.3 updateStageAction persists and clears `completed` (DB read-back)
- [x] 1.4 Snapshot round trip keeps `completed`; old snapshot restores as open
- [x] 1.5 Stage header menu checkbox DOM spec

### Phase 2: Worker gates

#### Automated

- [x] 2.1 listWorkerStageInvestments per-worker rule spec
- [x] 2.2 listWorkersWithActiveStages excludes a fully-zakończony worker
- [x] 2.3 Open-etap predicate unit spec
- [x] 2.4 tokenAction refuses `stagesCompleted`, no row stored
- [x] 2.5 Token page notice; preview still ready
- [x] 2.6 Scan refused, no row stored
- [x] 2.7 Draft: new refused, existing edit allowed and persisted
- [x] 2.8 Accept into a zakończony etap still succeeds

### Phase 3: Finished colour + docs

#### Automated

- [x] 3.1 Finished-tint wrapper unit spec (incl. precedence over a user colour)
- [x] 3.2 Stage header ✓ marker DOM spec
