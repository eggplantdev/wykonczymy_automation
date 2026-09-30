---
date: 2026-09-30T10:24:09+02:00
researcher: Claude (Opus 5.5)
git_commit: 87bef38df4a8bad37a8156258cfa91f12bb7053d
branch: kosztorys-stage-worker-split
repository: wykonczymy
topic: 'Worker work reports — ground the UI spike (worker form, manager verification dialog) and the later plan'
tags:
  [research, codebase, kosztorys, worker-view, stage-progress, share-token, notifications, mobile]
status: complete
last_updated: 2026-09-30
last_updated_by: Claude (Opus 5.5)
last_updated_note: 'Added follow-up research after the spike (acceptance write path, spoza rozpiski, isolation, persistence/token/nav) at 6b02742f'
---

# Research: worker work reports — spike grounding

**Date**: 2026-09-30T10:24:09+02:00
**Git Commit**: 87bef38d (branch `kosztorys-stage-worker-split` — EX-943's split tables are in the
working tree, uncommitted at the time of writing; references to `kosztorys_stage_workers` assume it lands)

## Research Question

The first stage of work is a UI spike: (1) the worker's form on the named link (phone + desktop),
(2) the manager's verification dialog with checkboxes. What does the codebase give us for both, and
what constrains the real implementation that follows? Decisions already made are in `change.md`.

## Summary

1. **The worker link has no write path, and neither does anything else public.** Every mutation
   runs through `protectedAction` → `requireAuth(MANAGEMENT_ROLES)` with no bypass. A report submit
   is the app's first **token-authenticated server action** — a new wrapper, not a relaxed existing one.
2. **The current worker page is the desktop datasheet grid in read-only mode.** On a phone it
   scrolls sideways; there is no card list, no sticky action bar, no mobile layout anywhere in the
   app's tables. The worker form is a **new component**, not a mode of the grid.
3. **Stage quantities are set-only.** `stage_progress (item_id, stage_id)` is written by an absolute
   upsert; nothing increments. Acceptance („dodaje") needs a new additive statement.
4. **An open editor tab will silently overwrite an accepted addition** — rows are frozen at mount
   and undo replays absolute before/after values. Acceptance therefore belongs **inside the editor**
   (patch the rows, prune the undo commands for those cells), or stage writes become conditional.
5. **Item and stage ids are not stable.** Five paths wipe and re-insert the whole tree with fresh
   ids (version restore, sheet import, „Wczytaj szablon", szablon overwrite, „Wyczyść kosztorys").
   A report line referencing an item id breaks the lesson-253 invariant. Recommended: FK with
   `ON DELETE SET NULL` + opis / j.m. / etap number+label copied onto the line; a line whose target
   vanished becomes a "re-map by hand" line. Needs an owner call (see Open Questions).
6. **The manager dialog is ~80% assembled already**: `CatalogueDiffTable` (accept-by-ticking, grouped
   rows, „Zaznacz wszystkie") + `SettlePayoutsTable` (tick + editable decimal amount, disabled until
   ticked). The „Pracownicy" menu + `KosztorysActionsProvider` is the documented slot for a new dialog.
7. **Badges are one cursor per user per route.** A per-investment „new report" signal doesn't fit
   the model as-is; where the badge sits is an open question.

## Detailed Findings

### 1. The worker link today

- `src/app/(share)/p/[name]/[token]/page.tsx:12-16` reads only `token` (the name segment is ignored,
  so a rename keeps the link alive) → `getWorkerKosztorysByToken` → `notFound()` on null (streamed,
  so HTTP 200 — `context/foundation/manual-checks.md:1997`).
- Token lookup `src/lib/queries/worker-kosztorys.ts:135-154`: **uncached** (revoke takes effect on the
  next request), `overrideAccess: true`, excludes trashed investments. Separate collection
  `kosztorys-worker-shares` — an investor token can never open a worker view and vice versa.
- Data: cached core `unstable_cache` key `worker-kosztorys-data-v2` (:111, tags :23-32) + firm-wide
  settings per request (:117-127).
- `/podglad-pracownika/[worker]/[id]` (`page.tsx:14-22`) is the **authenticated owner preview**,
  same bare `(share)` layout, same `WorkerKosztorysPage`, guard inside `getWorkerKosztorysPreview`
  (`worker-kosztorys.ts:160-161`).
- Scope `resolveWorkerScope` (`src/lib/kosztorys/worker-view/scope.ts:18-31`): the worker's etapy are
  those whose `split.members` contain him (EX-943). `blocked` for `no-stages` /
  `unconfirmed-plane` / `mixed-planes` — **a blocked scope ships no tree**, so no form can render.
- Props reaching the page (`worker-view/types.ts`): `WorkerKosztorysT` = ready
  `{investmentId, investmentName, tree, worker: WorkerAudienceT}` | blocked `{reason, …names}`.
  `WorkerAudienceT` carries `plane`, `summary`, `settings`, `executedQtyByItem` (Σ over ALL etapy,
  used for „Pozostało").
- Allowlist ceiling (`columns.ts:17-30`, `settings.ts:39-76`): no client price, rabat, brutto,
  mnożnik, „Komentarz", other crews' etapy — settings only subtract. On a shared etap the row figures
  are the whole etap's; his part is „Twój udział" in the summary (`summary.ts:94-121`).
- Rendering (`src/components/kosztorys/worker-view/worker-kosztorys-page.tsx:8-38`): server wrapper
  around the client `KosztorysEditorBody` (`DynamicDataSheetGrid`, `h-dvh`, read-only via
  `readOnly = preview || locked`, `use-kosztorys-editor.ts:176`). Only the header has `sm:` handling.
- Link lifecycle: revoke deletes the row (`kosztorys-worker-share.ts:33-38`); regenerate rotates the
  token; unassigning all etapy or deactivating the worker does **not** revoke (EX-888, domain notes
  `:386-392`). → **A still-resolving token is not permission to write; the write action must
  re-run the scope on every call.**

### 2. Public write surface — what a token action must look like

- `protectedAction` (`src/lib/actions/run-action.ts:37-69`) always calls `requireAuth` (:46);
  `investmentAction` (`investment-action.ts:34-80`) adds the lock/trash gate.
- Existing unauthenticated writes: only the three lead webhooks, each behind HMAC / shared secret
  (`api/webhooks/landing/route.ts:42`, `wpforms/route.ts:24`, `facebook-leads/route.ts:37`).
- Shape for the new wrapper (lessons.md:568 — the bound must come from the server, never the caller):
  takes the **token** (never `workerId` / `investmentId` / a `Where`) → same uncached lookup →
  `resolveWorkerScope` → accept only `(itemId ∈ investment, stageId ∈ scope.stages)` pairs, zod-parsed
  → the investment lock gate (`investmentGateFor`) → write **only** to the report tables. Its own
  cache tag, expired with `updateTag`.
- **Owner ruling (2026-09-30, change.md #13): no hardening beyond this.** A report reaches the
  rozpiska only through a manager's tick, so the worst a leaked or guessed token does is bot spam in
  the reports list — accepted, not defended against up front. The pair check above stays because a
  line pointing at a pozycja outside the etap would be a wrong report, not an attack.

### 3. Stage quantity storage and the editor

- `stage_progress`: `item_id` / `stage_id` FKs `ON DELETE CASCADE`, `qty_done numeric`,
  `UNIQUE (item_id, stage_id)`, sparse (missing = 0) (`src/migrations/20260709_0_add_kosztorys_stages.ts:23-33`).
- Writers: `setStageProgressAction` (`src/lib/actions/kosztorys.ts:766-790`, absolute
  `ON CONFLICT … SET qty_done = <value>`, revalidates `stageProgress` with `deferRefresh`) and the bulk
  tree insert (`insert-kosztorys-tree.ts:126-139`). **No increment anywhere** → acceptance needs
  `SET qty_done = stage_progress.qty_done + EXCLUDED.qty_done`.
- „Pomiar z natury" = Σ etapów holds in code (`settlement-rows.ts:6-23`, SQL twin
  `kosztorys-client-totals.ts:45-50`). `sheet_measured_qty` is a Google-sheet copy — acceptance
  never touches it.
- Editor rows: `useState(() => treeToRows(tree))` (`use-kosztorys-editor.ts:186`) + `prevById` (:243).
  Undo writes absolute values (`:761-766`) on per-cell lanes `stageLane(item, stage)` (`:1243-1251`).
- **Failure mode:** an addition accepted while an editor tab is open is overwritten by that tab's
  next edit of the cell or by an undo of an earlier edit — silently (ids stay alive, so
  `useStaleTreeRecovery` never fires). Same family as lessons.md:165 and :1628; the code names the
  analogous hazard for row delete (`:867-869`, EX-526 #2).
- Two in-editor routes: **(a)** flush undo, server returns new per-cell totals, `patchRows`
  (`:1216-1224`) + `pruneByIds(acceptedItemIds)` (`use-undo-redo.ts:88-99`), serialized behind the
  cell's `stageLane` (lessons.md:172); **(b)** bump `investments.updated_at` and `onTreeReplaced()`
  → remount (`kosztorys-editor-v2.tsx:31,42-56`) — simpler, but loses sort/filter/undo. (a) is the
  better UX; (b) is the fallback. Precedent for bumping `updated_at` from a side write:
  `kosztorys-item-texts.ts:40-43`, `kosztorys-sheet-measured-qty.ts:29-32`.

### 4. Identity of a report line

- Wipe-and-reinsert paths, all through `restoreKosztorys` (`restore-kosztorys.ts:35-38`), all minting
  new ids: version restore `kosztorys-snapshots.ts:92`; sheet import `kosztorys-import.ts:307`;
  „Wczytaj szablon" `reload-from-preset.ts:28`; szablon overwrite `kosztorys-presets.ts:103`;
  „Wyczyść kosztorys" `kosztorys.ts:288`. Item/section delete is a hard delete cascading to
  `stage_progress` (`kosztorys.ts:332-356`, `:494-508`).
- No stable uid on items or stages. Stage `ordinal` survives a restore but a new etap after deleting
  the last one reuses its number (`kosztorys.ts:624-634`).
- EX-943's `kosztorys_stage_workers` dodged the problem by living **inside** the snapshot
  (`snapshot-format.ts:131-141`, `insert-kosztorys-tree.ts:86-123`). Reports can't: they must
  outlive a restore, not roll back with it.
- Precedent for an outside FK into the tree: `transactions.kosztorys_stage_id` `ON DELETE SET NULL`
  (`20260718_1`), dropped in `20260721_0` (EX-536).
- Options: **A** FK `ON DELETE SET NULL` + copied opis, j.m., etap number, etap label (history needs
  the copies anyway; a pending line whose target vanished becomes a manual re-map); **B** a stable
  `uid` on items/stages carried through every tree writer (survives version restore only; import and
  szablon reload still mint new ones; touches the lesson-530 checklist); **C** opis + j.m. match —
  unreliable (the same praca lives in several sekcje by design, EX-761), usable only as a suggestion.
  **Recommendation: A**, with lesson 253 updated to name the report tables as the first referrer.

### 5. Manager dialog building blocks

- „Pracownicy" menu (`toolbar/menus/kosztorys-workers-menu.tsx`): per worker label + preview / link /
  print (:53-60), one global „Ustawienia widoku…" (:65); reads link holders live on open (:31). A menu
  item can't own its dialog (the menu unmounts on select) — state lives in `KosztorysActionsProvider`
  (`actions/kosztorys-actions-context.tsx:25-66`, deliberately outside `KosztorysEditorProvider`,
  EX-496); dialogs mount as siblings in `kosztorys-actions-menu.tsx:146-160`. „Zgłoszenia prac"
  slots in as one global entry above „Ustawienia widoku…"; the trigger (:32-37) can carry a `CountBadge`.
- Dialog primitive `src/components/ui/dialog.tsx:56-64`: full-screen `h-dvh` sheet under `sm`,
  centred `max-h-[90vh]` above; width tokens `dialog-sm…dialog-xl` (`globals.css:54-61`),
  `--spacing-dialog-scroll: 55vh` (:70). `FormDialogShell` (`ui/form-dialog-shell.tsx:26-55`).
- **Accept-by-ticking**: `CatalogueDiffTable` (`dialogs/catalogue/catalogue-diff-table.tsx`) — hand
  `<table>` (a checkbox column breaks `ComparisonTable` alignment, :17-23), selection keyed by id
  (:40), parent/child rows (:169-190, :233-270) that map onto „pozycja → etap lines",
  `indeterminate` (:143-144), „Zaznacz/Odznacz wszystkie" with `CheckCheck` (:95-102), „Aktualizuj
  kosztorys (N)" clearing only on success (:81-89), automatic version before the write
  (`catalogue-compare-dialog.tsx:35-36`).
- **Tick + editable figure**: `SettlePayoutsTable` (`forms/settle-payouts-form/settle-payouts-table.tsx`)
  — `TickCell` (:84-95), `AmountCell` `Input inputMode="decimal"` disabled until ticked (:97-121),
  live values via context so the caret input isn't remounted (:34-37), footer total (:217-236).
- History list: „Wersje" (`dialogs/kosztorys-versions-drawer.tsx`) — fetch on open, grouped headings,
  bordered rows with `formatPLDateTime` + author. List → detail: `CatalogueCompareDialog`
  (`useState` id + second dialog mounted while picked, :55, :157-164).
- Decimal input: `Input inputMode="decimal"` + `parseDecimalInput` (`lib/utils/parse-decimal-input.ts:11`),
  format with `decimalText`. Uncontrolled `defaultValue` precedent survives a half-typed „12,"
  (`stage-split-dialog.tsx:174-191`). Not `DecimalField` (commits on blur).
- Adding a new work later: `addItemAction(sectionId)` creates a blank row, no prefill
  (`kosztorys.ts:426`); catalogue picker `actions/catalogue-picker-host.tsx:18-55`.

### 6. Notifications

- `notification_reads (user_id, stream, seen_at)`, `stream` is plain text → a new stream needs no
  migration (`src/migrations/20260708_add_notification_reads.ts:10-17`). `STREAMS` / `EPOCHS` /
  `countUnreadX` / `markSeen` in `src/lib/db/notifications.ts`. Aggregated in
  `src/lib/queries/unread-counts.ts:20-34`, management roles only. Badge = `unreadStream` on a nav
  link (`lib/constants/sections.ts`), cursor written by the stream page's server component.
- Gap: one cursor per user per **route**. A report belongs to an investment, and the manager
  verifies it inside that investment's editor. Either a nav-level stream (a list page of pending
  reports across investments) or a per-investment key / cursor written from a server action.
- `/zgloszenia` is already the leads route — pick another name.

### 7. Phone patterns

- No card list, no sticky bottom bar anywhere; tables scroll sideways (`data-table.tsx:187`). The
  only phone-native surface is the dialog sheet.
- Search: `useSearchFilter` / `foldText` (`src/hooks/use-search-filter.ts:6-42`) — accent-folded, so
  „sciany" finds „ściany". The editor's own `filterRows` (`row-view.ts:8-17`) does not fold.
- Drafts: `createFormStore` persists to **sessionStorage** (`src/stores/create-form-store.ts:5-28`),
  which dies with the tab — a worker's draft must be **server-side** (a report row in `draft`).
  Flush on `visibilitychange` → hidden with a normal action (lessons.md:2387).

## Code References

- `src/app/(share)/p/[name]/[token]/page.tsx:12-16` — worker link entry
- `src/app/(share)/podglad-pracownika/[worker]/[id]/page.tsx:14-22` — authenticated preview twin
- `src/lib/queries/worker-kosztorys.ts:44-161` — data builder, token lookup, preview guard
- `src/lib/kosztorys/worker-view/scope.ts:18-31` — the worker's etapy
- `src/lib/actions/run-action.ts:37-69` — `protectedAction`
- `src/lib/actions/kosztorys.ts:766-790` — `setStageProgressAction` (absolute upsert)
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:186,761-766,1216-1251` — frozen rows, undo, patchRows, lanes
- `src/lib/kosztorys/restore-kosztorys.ts:35-38` — the wipe every replace path shares
- `src/components/kosztorys/editor/dialogs/catalogue/catalogue-diff-table.tsx` — accept-by-ticking
- `src/components/forms/settle-payouts-form/settle-payouts-table.tsx` — tick + editable amount
- `src/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.tsx` — menu slot
- `src/lib/db/notifications.ts` — badge streams

## Architecture Insights

- **Staging table between an untrusted writer and the ledger.** The worker writes reports; only a
  manager moves figures into `stage_progress`. Same shape as a moderation queue / pull request:
  the public surface can only propose.
- **Frozen history = copied fields, not a live join.** The report line copies what it showed
  (opis, j.m., etap) so the tree can change underneath without rewriting history — the same reason
  invoices copy the price rather than join the catalogue.
- **Additive write vs absolute client state.** The editor is built on absolute values (upsert, undo
  by before/after). An additive write from outside is a second writer on the same cell, so it must
  enter through the editor's own lane or the client must be reseeded.

## Historical Context (from prior changes)

- `git show 985cb683:context/archive/2026-09-28-kosztorys-worker-view/design.md` — part 1 designed the
  link to identify the worker precisely so part 2 need not rewrite it; allowlist-as-ceiling.
- `context/archive/2026-07-27-kosztorys-stage-worker-assignment/change.md` — a plane-less etap takes
  no worker; "one stage, one worker" superseded by EX-943's `split.members`.
- `context/archive/2026-09-29-worker-view-settlement-columns/change.md` — settlement columns appear
  only after the first entry in HIS etapy.
- `context/archive/2026-09-30-settle-payouts-pool/change.md:16-17` — the most recent spike:
  built in place in the working tree on the real local DB, owner approved from screenshots, then
  hardened as a change. Univer spike (`fcbf647f`, deleted `a6089ef4`) used a throwaway route + JSON.
- `context/foundation/lessons.md` :165, :172, :253, :568, :1628, :1737, :1772, :2387 — cited above.

## Spike placement (recommendation)

- **Worker form**: its own route, NOT a child of the worker preview — the owner rules the form a
  separate surface from the link/PDF (change.md #12). Spike: `(share)/zgloszenie-prac/[worker]/[id]`
  — real rozpiska data through
  `getWorkerKosztorysPreview`, no token, no migration, bare share layout. Draft in client state;
  „Wyślij do weryfikacji" is a toast. New mobile-first component, not the grid.
- **Verification dialog**: mounted in the editor from the „Pracownicy" menu, fed by a fixture report
  built from the open investment's real items (so pozycja names are real).
- **Viewing on a phone**: staging is behind Vercel SSO (`context/reference/manual-verification.md:55`);
  local LAN needs `allowedDevOrigins` in `next.config.ts` (Next blocks dev resources from a LAN IP
  otherwise — unverified here, check on first try).

## Open Questions

1. **Pending reports across a restore / import / szablon reload** — accept that their lines become
   "re-map by hand" (option A), or pay for stable uids (option B)?
2. **Where the badge lives** — a nav entry with a cross-investment list of pending reports, or only
   inside each investment (editor „Pracownicy" menu, investment card)?
3. **Acceptance when the worker is no longer on that etap** — allowed (the work was done) or refused?
4. ~~What the form shows per pozycja~~ — resolved: „Opis prac", j.m., quantity input only (change.md #10).
5. ~~Several etapy per worker~~ — resolved: one report per etap, etap picked first (change.md #9).
6. ~~Draft saving~~ — resolved: autosave as he types (change.md #11).

## Follow-up Research 2026-09-30T14:18+02:00 (po spike'u)

**Git Commit**: 6b02742f (staging). The spike is still uncommitted in the working tree.
Owner decisions 14–20 (`change.md`) are the input. Four questions: the acceptance write path, the
„spoza rozpiski” lines, pulling the report out of the shared editor body, and the
persistence / token / nav layer.

### What the spike invalidated above

- **§ Summary 2 and § Spike placement say „a new mobile-first component, not the grid”. This is
  superseded.** The report is typed into the worker's rozpiska grid, in the „Zgłaszam” column.
- **Summary 5 and Open Questions 1–3 are answered.** 1 → option A, with lines „do przypisania ręcznie”
  (#14). 2 → a nav entry plus the toolbar button (#15). 3 → accept anyway (#20).
- **A report carries no etap.** The kierownik picks the target at acceptance (#16, #17), so the
  §2 pair check `(itemId, stageId ∈ scope)` shrinks to `itemId ∈ investment`. change.md #9
  („one report per etap”) is superseded the same way.
- §7 search: the report uses the editor's own `filterRows`, not the list's `useSearchFilter`.

### A. Acceptance: one action, one transaction

`acceptWorkerReportAction(reportId, decisions, target)` runs on `investmentAction`, then one
`withPayloadTransaction`:

1. `lockInvestmentGates(tx, [inv])` (`src/lib/db/investment-gate.ts:75-90`). It re-checks the
   lock and trash gate under `FOR UPDATE` and serialises two acceptances on one investment, which
   also closes the etap-number race: `addStageAction` numbers with `MAX+1` and no lock,
   `src/lib/actions/kosztorys.ts:621-629`.
2. **Claim the report**: `UPDATE … SET status='accepted' WHERE id=$1 AND status='pending'
RETURNING`. Zero rows → refuse. Without this, a double click adds the quantities twice.
3. **Check the pozycje**: `id = ANY($ids) AND investment_id=$inv`. A missing id is refused, not
   skipped; the dialog then shows that line as „do przypisania ręcznie” (#14).
4. **Target**:
   - **Nowy etap**: next number, the worker's plane (`resolveWorkerScope(...).plane`,
     `src/lib/kosztorys/worker-view/scope.ts:18-31`), plus
     `insertStageMembers(tx, [{ stageId, split: oneWorkerSplit(workerId) }])`
     (`src/lib/kosztorys/stage-split.ts:63-65`).
     - A different plane would make his link `mixed-planes`, so the server refuses it.
     - A worker with no etapy left (#20) has no plane to derive; the kierownik picks it.
   - **Existing etap**: membership check against `kosztorys_stage_workers` at acceptance time.
     No assignment history is stored, so „his etapy” means his current ones. An unassigned
     worker can only go to „Nowy etap”, which puts him back on the crew. **Confirm with the owner.**
5. **Spoza rozpiski → new pozycje** (§B).
6. **Additive upsert**, one statement for every line:
   `ON CONFLICT (item_id, stage_id) DO UPDATE SET qty_done = stage_progress.qty_done +
EXCLUDED.qty_done`. No such statement exists today; the only writer sets an absolute value
   (`kosztorys.ts:778-783`).
7. Store on the report: the accepted qty per line, `created_item_id`, and the target with its
   copied etap number and label.
8. `UPDATE investments SET updated_at = now()`, precedent `src/lib/db/kosztorys-item-texts.ts:40-43`.
9. Optionally `captureAutoSnapshot` first, as the katalog compare does before its write.

Tags: `kosztorysStages`, `stageProgress`, `kosztorysItems`, `investments`, with no `deferRefresh`.
They also expire the worker's rozpiska (`WORKER_KOSZTORYS_TAGS`,
`src/lib/queries/worker-kosztorys.ts:23-32`).

**Editor coherence: remount, not patch.** The two sub-researches disagreed; this is the synthesis.

- Etapy are local state. `handleAddStage` appends after its own action and `setStages` is not
  exposed (`editor/hooks/use-kosztorys-stage-ops.ts:45,55-64`), so adopting an etap created
  elsewhere needs a new method.
- Patching in place also needs: new rows for the spoza-rozpiski pozycje (`rowsFromSections` hard-codes
  `progress: []`, `use-kosztorys-editor.ts:1023`), `pruneByIds`, and waiting on several
  `stageLane`s. `useDebouncedSave.runNow` cancels a pending save rather than flushing it
  (`hooks/use-debounced-save.ts:76-82`).
- „Nowy etap” is the default target, so the patch path would be the common case, not the rare one.
- **Recommendation: bump `updated_at`, then call `onTreeReplaced()`** (precedent
  `actions/clean-item-texts-action.tsx:26,33`; the remount keys on `treeToken`,
  `kosztorys-editor-v2.tsx:31,54-57`).
  - Cost: search, sort, filters and undo reset, and the dialog closes. Acceptable for a
    deliberate action.
  - Before accepting, flush pending cell saves, so an unsaved edit is not lost on the remount.

Residual risk: **another** open editor tab keeps its copy of the cell and overwrites the
addition on its next edit or undo. This is the same hazard as two tabs today (lessons.md:165,
:1628); it is not new to this change.

### B. „Spoza rozpiski” → a new pozycja

- **No prefilled insert exists** for a single row. `addItemAction` / `insertItemAction` go through
  `createBlankItem` (`src/lib/kosztorys/create-item.ts:48-72`).
- **The model to copy is the katalog insert**: `placeCatalogueItems` (`place-catalogue-items.ts:59-93`).
  The server re-reads prices by katalog id, `asItem` maps the fields (`:26-46`), rows take
  consecutive slots, and a price over the ceiling warns rather than refuses. Generalise it to
  `placeItems(db, placement, seeds)` with two seed kinds:
  - **dopisana praca**: the worker's opis and j.m., `clientPrice` = the kierownik's „Cena j.m.”
    (netto), both stawki `null`, so the worker's stawka follows the współczynnik;
  - **katalog swap**: re-read by id on the server and copy it as `asItem` does. Never trust a
    cena from the client.
- **Position**: `sectionOwnerAndNextItemOrder` (`create-item.ts:12-45`) gives MAX+1 and also
  checks the sekcja belongs to the investment. There is no UNIQUE on `display_order`.
- **Katalog matching**: `closestEntries` + `hintCandidates`
  (`work-catalogue/build-catalogue-comparison.ts:43-66`) are pure and usable on either side. They
  are opis-only, score ≥ 0.55, and return top 3. A hint stays a suggestion the kierownik clicks,
  never an automatic swap (lessons.md:274).
- **Fix before reuse**: the spike compares j.m. as raw strings (`review-lines-table.tsx:167`);
  use `foldUnit`, as `catalogueKey` does. The spike's katalog search uses cmdk's own filter;
  the app's `useSearchFilter` folds diacritics.
- **Consequences for the owner**:
  - Every accepted dopisana praca shows up in „Problemy” as „wykonane bez przedmiaru”
    (`row-conditions/registry.ts:453-460`). That follows from the owner's „bez przedmiaru”.
  - A praca priced by hand joins the EX-761 divergent-price problem whenever the same praca sits
    elsewhere at another cena.
  - A swap to a katalog wpis already in that sekcja creates a duplicate. Warn via
    `already-in-kosztorys.ts`, or offer to add the quantity to the existing pozycja.
  - An empty rozpiska has no sekcje. Offer „Nowa sekcja” (`section-target.ts:4`).
- **Open**: after a swap, the spike keeps the cena editable. Either lock it to the katalog's cena,
  or accept that an edited cena keeps the katalog's stawki, where a fixed kwota stops following
  the cena.

### C. Pulling the report out of the shared editor body

- **17 `report` branches today**:
  - `kosztorys-editor-body.tsx`: 14 — prop threading, section-band `isBare`, „Razem” band filter,
    a footer portal into `.dsg-container`, `gridMinWidth`, the page-scroll layout, the header
    render-prop, dropped `overflow-hidden`, grid classes, the Lp gutter off, `WorkerSummary` hidden;
  - `use-kosztorys-editor.ts`: 3 — seeding at `:195-197`, `withReportColumn` at `:598-600`,
    `applyReportChanges` at `:1239-1255`;
  - `section-header-cell.tsx`: `isBare`.
- **Almost every part is already exported and React-free**:
  - `treeToRows`, `buildViewRows`, `buildSectionBandRows`;
  - `buildV2Grid` — only `view` and `stages` are required, and `workerSurface` is optional;
  - `withSyntheticRows`, `ordinalGutterColumn`, `resolveRowHeight`, `workerDataHiddenColumns`,
    `gridMinWidth`.

  The only thing stuck in the hook is the worker's view pin plus the condition context, which is
  two lines to re-derive.

- **The stage-id-0 sentinel goes away.** It exists only so the hook's `planGridChanges` sees the
  edit as a stage edit. A component that owns its rows holds `qtyByItem` in state and makes
  „Zgłaszam” a plain column. That also removes the duplicated state (grid rows plus draft strings,
  mirrored through `String(qty).replace('.', ',')`).
- **Bug found (still in the spike)**: the „Wszystkie prace” off filter hides a row that is empty
  on both axes (`registry.ts:22-23`). Σ etapów iterates only real etapy, so a pozycja bez
  przedmiaru that he just typed into **disappears** when he switches the chip off. The isolated
  component adds `|| qtyByItem[id] > 0` to its own filter.
- **Owed layout** (Lp and j.m. in compact mode from 768px): dsg columns are built in JS, so this
  needs a `matchMedia` `sm` hook. None exists yet, and hiding columns with CSS leaves gaps.
  Isolated, the hook stays out of the shared body.
- **Recommendation: isolate in the real implementation.**
  - Size: about 4 files, net about +150 lines. A new `worker-report/report-grid.tsx` of about
    200 lines plus a rows hook; about 60 lines leave the body and about 25 leave the hook.
  - Risk: low. What gets duplicated is dsg config (row height, row class), and it stays thin
    because `withSyntheticRows` / `resolveRowHeight` stay shared.
  - The pattern is composition over a mode flag: `preview` / `worker` / `pastVersion` / `report`
    are four flags multiplying through one god component. It also follows the EX-521 rule.

### D. Persistence, token, nav

**Tables: raw, not Payload collections.** Precedent: `kosztorys_stage_workers`
(`20260930_1…:7-8`), `kosztorys_snapshots`, `notification_reads`.

```
worker_reports       id, investment_id → investments CASCADE, worker_id → users,
                     status pending|accepted|rejected, sent_at, decided_at, decided_by → users SET NULL,
                     target_stage_id → kosztorys_stages SET NULL, target_stage_ordinal, target_stage_label,
                     CHECK ((status = 'pending') = (decided_at IS NULL));
                     partial idx (investment_id) WHERE status = 'pending'
worker_report_lines  id, report_id → worker_reports CASCADE, position, kind rozpiska|extra,
                     item_id → kosztorys_items SET NULL, description, unit, section_name (copied),
                     reported_qty > 0, accepted_qty (NULL on a decided report = rejected),
                     created_item_id → kosztorys_items SET NULL, catalogue_item_id SET NULL;
                     idx (item_id), idx (created_item_id)
worker_report_drafts (investment_id, worker_id) PK, payload jsonb, updated_at
```

- **Index `item_id` / `target_stage_id`.** `restoreKosztorys` deletes the whole tree, and every
  deleted row runs the SET NULL lookup. Unindexed on a 1000+ row kosztorys, each of those
  lookups scans the whole lines table.
- **Tree writers must never touch these tables**: the wipe in `restore-kosztorys.ts:35-36`,
  `insertKosztorysTree`, `snapshot-format`, `apply-preset.ts`, and the drift spec's
  `INSERT_COLUMNS`.
- **Update lesson 253** (`lessons.md:253-258`): `worker_report_lines` is the first outside table
  that stores tree ids, on purpose.
- **Deleting a worker**: add a probe for his reports in `users.ts` next to
  `countStageMemberships` (`:56`). An accepted report names him in a figure.

**Draft on the server.**

- The page reads it uncached and passes it as the initial value, so the `isLoaded` gate and its
  effect go away (`use-report-draft.ts:21-35`).
- Autosave: a debounced token action, plus a flush on `visibilitychange` → hidden
  (lessons.md:2387). This is the first use of `visibilitychange` in `src`.
- Send runs in one transaction: insert the report and its lines, then delete the draft.
  - **Race**: a debounced save that lands after the send recreates the draft. Cancel it before
    sending, or have the send read the stored draft after a flush.
  - The grid remounts via `key` after a send; it does not reseed from new props.
- Draft keys whose pozycja vanished after a tree replace are filtered out on load.
  **Open**: drop them silently, or turn them into „do przypisania” like a sent line (#14)?

**Token — its own link (#18).**

- A new collection `worker-report-shares`, mirroring `kosztorys-worker-shares`, plus a third
  `ShareRowT` variant (`share-token.ts:10-12`).
  - Not a `kind` column: the existing collection says the token alone picks the view
    (`kosztorys-worker-shares.ts:3-5`), and the unique `(investment, worker)` index would block a
    second row anyway.
  - It reuses `writeShareToken` and `deleteShare`.
- A report stores `(investment, worker)`, never the share row. A revoke or rotation leaves it
  alone (#20).
- **`tokenAction`** in `run-action.ts`: pull the perf / try-catch / failure / revalidate tail of
  `protectedAction` (`:37-69`) into a shared helper. The token path then runs:
  1. an uncached token lookup (as in `worker-kosztorys.ts:135-154`);
  2. `investmentGateFor` — zakończona is `status === 'completed'` (`investment-lock.ts:20-23`),
     so blocking it (#20, not yet confirmed) costs nothing extra;
  3. `users.active`;
  4. a zod check that every `itemId` belongs to the investment;
  5. writes to the report tables only.

  The kierownik side stays on `investmentAction`, with no worker scope check.

- **`proxy.ts:14` lets only `/k/` and `/p/` through without a session.** The report route must be
  added, or its Server Action POSTs bounce to login.
- **Open**: `resolveWorkerScope` blocks (`no-stages` / `mixed-planes`) and a blocked scope ships
  no tree. A worker with no etapy yet cannot report, yet #16/#17 allow a report into a new etap.
  Does the report page need the pricing scope at all, or only the rozpiska tree for an active
  worker with a valid link?

**What the report page needs** (#19): the tree, his draft, his pending lines summed per pozycja
(„Zgłoszono”), his sent reports with status and date, and whether the investment is locked. All
of it is uncached and small (one worker, one investment).

**Nav (#15).**

- **A pending count, not an unread cursor.** A report is a to-do, and a cursor would drop the
  badge to 0 while reports still wait. Add `workReports` to `UnreadCountsT` and a COUNT to
  `fetchUnreadCounts` (`unread-counts.ts:20-34`); no `STREAMS` entry.
- **Route trap**: `/zgloszenia-prac` passes `startsWith('/zgloszenia')` in `unread-badge.tsx:28`,
  which is the leads badge. Switch that line to the `${href}/` rule (`use-nav-links.ts:10-12`)
  or pick another path. The page needs `PAGE_TITLES` plus `loading.tsx` (EX-877).
- **Deep link, no precedent**: `/inwestycje/<id>/kosztorys_v2?zgloszenie=<reportId>`. The page
  reads the param, the dialog state moves from the button's local `useState`
  (`worker-reports-button.tsx:14`) into `KosztorysActionsProvider`, and `router.replace` drops
  the param after opening.

**Cache**: every report read stays uncached, including the counts, the dialog (fetched on open,
like „Wersje”), the draft and the worker's list. So a draft save or a send expires nothing, and
the SET NULL from tree deletes cannot leave a stale cached report (the lesson 246 trap).

### Spike code: what survives

| Keep, rewire to the server                                                                                                                                                                                                                                                                                                                                                                                    | Spike only, delete                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `worker-reports-dialog` (the shell), `-list`, `worker-report-review`, `review-lines-table` (on `DataTable`), `line-draft`; `worker-report/` `types`, `parse-report-qty`, `unit-options`, `to-form-data`; `report-columns`, `section-pill`, `branded-header`, `extra-work-rows`, `extra-works-dialog-button`, `report-bar`, `send-bar` (line building), `worker-report-form`, `report-grid` (rewritten per §C) | `use-report-draft`, `spike-report-store`, `use-pending-report-count`, `sample-report` (and its call in `kosztorys-workers-menu.tsx:40-44`), `ReportModeT` |

### Owner questions this raises (sheet vocabulary)

1. **A worker no longer on any etap**: his report can only go to „Nowy etap”, which puts him back
   on the crew of this inwestycja. OK?
2. **A worker with no etapy at all**: can he report? Today his rozpiska link shows him nothing
   until he is on an etap.
3. **Zgłaszanie on a zakończona inwestycja is blocked**: still unconfirmed (#20).
4. **After a katalog swap, is the cena fixed** to the katalog's, or can the kierownik still edit it?
5. **An accepted dopisana praca lands bez przedmiaru**, so it shows in „Problemy”. Intended?
