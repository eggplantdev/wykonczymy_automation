# Kosz inwestycji — Implementation Plan

## Overview

Owner and admin can move an investment to a shared `/kosz` page. From there they can restore it or
delete it for good. While an investment sits in the trash it is hidden everywhere and frozen, and
its investor link is dead. The cleanup cron empties the trash after 30 days, except for investments
whose kosztorys was really used (Przedmiar or Pomiar ≠ 0). Those wait for a manual delete, which
asks for the investment's name to be typed. Every user-facing decision is recorded in `change.md`.
This plan only turns those decisions into code.

## Current State Analysis

The only way to delete an investment today is a hard delete from the unused `/admin`. The only
guard is `preventDeleteWithTransactions`, which blocks the delete while live transactions exist
(`src/collections/investments.ts:24`, `beforeDelete`). The DB cascade then silently removes:

- the kosztorys: items, sections, stages, snapshots
- the share link, `stage_progress` and `investments_rels`

It also unlinks:

- the v1 sheet
- the lead
- cancelled transactions
- equipment events

Full inventory: `research.md`.

### Key Discoveries:

- **Hiding chokepoint.** `fetchReferenceData` excludes the szablon workshop once
  (`src/lib/queries/reference-data.ts:62-73`). It feeds the listing, pickers, dashboard, crumb, and
  the `notFound()` on `/inwestycje/[id]` (`page.tsx:55-56`) and `kosztorys_v2`. One more `WHERE`
  clause hides a trashed investment on all of these.
- **Pages that bypass the chokepoint.** `/inwestycje/[id]/kosztorys` (v1) and
  `/podglad-inwestora/[id]` load the row through `requireInvestmentOr404` → `getInvestment` →
  `payload.findByID` (`src/lib/queries/investments.ts:46-54,69-89`). A trashed row would still
  render there.
- **The public share read** (`getPreviewKosztorysByToken`, `src/lib/queries/preview-kosztorys.ts:117-136`)
  maps a token straight to an investment id and does no investment check at all.
- **The write gate.** `investmentGateFor` / `investmentGateForRow` / `isInvestmentLocked` /
  `isRelatedInvestmentLocked` (`src/lib/db/investment-gate.ts`) answer "completed?" as a boolean.
  Every consumer then pairs `true` with `INVESTMENT_LOCKED_MESSAGE`:
  - `investment-action.ts:78`
  - `hooks/transfers/validate.ts:75`
  - `hooks/transfers/guard-delete.ts:17`
  - `actions/transfers.ts:56,101,175`
  - `actions/sheets.ts:168`
  - `access/investment-lock.ts:65,67`

  A trashed investment needs its own sentence, so the boolean cannot stay.
- **Existing action wrappers.** `ownerOnlyAction` (`src/lib/actions/owner-only-action.ts`) narrows
  to owner/admin but cannot forward revalidation. `protectedAction` takes `revalidate` and
  `opts.entityTags`.
- **Transaction probe.** `makePreventDelete` counts inside `req`, so it joins the caller's
  transaction (`src/hooks/prevent-delete.ts:44-58`). The trash action must run the identical probe.
- **The cleanup cron** (`src/app/(payload)/api/cron/cleanup/route.ts`) has one step: `gcSnapshots`.
  It has no try/catch and no `maxDuration`. The partial-failure pattern to copy is
  `leads-reconcile/route.ts:45-51`.
- **Owner-only page guard pattern:** `requireAuth(ADMIN_OR_OWNER_ROLES)` + `redirect('/zaloguj')`
  (`src/app/(frontend)/raporty/page.tsx:17-18`).
- **Nav:** `useNavLinks` only splits links by `isManagementRole` (`src/hooks/use-nav-links.ts:19`).
  Links are defined in `src/lib/constants/sections.ts`.
- **Lesson — cascades Payload never sees.** A DB `ON DELETE CASCADE` deletes rows without firing
  Payload hooks, so the child collections' cache tags must be expired by hand
  (`context/foundation/lessons.md`).

## Desired End State

The listing's „Akcje" column shows a „Usuń" button to the owner and admin. It is not shown on the
warsztat, which never reaches the listing anyway. Clicking it moves the investment to the trash
after a plain confirmation. If the investment has a live transaction, the action is refused with a
sentence that names the count.

`/kosz` is reachable from the sidebar („Kosz", last entry, owner/admin only). It lists trashed
investments with:

- the name
- the date it was deleted
- either „usunie się samo za N dni" or „kosztorys w użyciu — tylko ręcznie"
- the actions Przywróć and Usuń na zawsze

„Usuń na zawsze" asks for the investment's name to be typed only when its kosztorys was really used.
Otherwise it is a plain confirmation.

While an investment is in the trash:

- It is missing from the listing, pickers, dashboard and sums.
- `/inwestycje/<id>`, `/kosztorys_v2`, `/kosztorys` and `/podglad-inwestora/<id>` all return 404.
- `/k/<token>` returns 404.
- Every write gate refuses with „Inwestycja jest w koszu — przywróć ją, żeby coś zmienić."

„Przywróć" restores the investment exactly as it was, and the same token works again. The daily
cron purges unused investments that have been in the trash for more than 30 days, and reports
`{ purged, skippedKosztorys, blocked, failed }`.

## What We're NOT Doing

- **Payload `trash: true`.** Rejected in `research.md`. Its reads fail closed, it breaks the media
  reference probes (which risks deleting Blob bytes irreversibly), and it would make the share page
  return 500.
- **Deleting media.** Files stay behind as orphans. `kosz-plikow` owns cleaning them up.
- **A generic "kind in trash" abstraction.** `/kosz` gets one „Inwestycje" section. Other kinds come
  later in their own changes.
- **Gating share-link generation and `previewMaterialSync`.** A trashed investment's pages all
  return 404, so the UI cannot reach either one. A link generated by calling the action directly is
  dead anyway, because the resolver refuses trashed investments.
- **Extending the `/admin` access-layer `Where` (`LOCK_PATHS`) to trashed investments.** The admin
  panel is unused. The create path in `access/investment-lock.ts` picks up the new lock anyway,
  because it goes through the same helper.
- **The `/kosztorysy` v1 list and the equipment "currently at" label.** Both stay as they are.
- **Trimming snapshots in the trash.** `gcSnapshots` stays unchanged.
- **A counter on the „Kosz" nav entry.**

## Implementation Approach

The work runs in four phases:

1. **Data plane.** One nullable column, hidden at the single read chokepoint plus the three paths
   that bypass it. The write gate learns a second reason to refuse.
2. **Server actions.** Trash, restore and delete-forever sit on that foundation.
3. **UI.** The trash page, the nav entry and the listing button come last on the client side.
4. **Cron purge.** It reuses the phase 2 delete path, so the purge and the manual delete refuse for
   the same reasons.

## Critical Implementation Details

- **The migration is additive**, so prod migrates **before** the code ships (a human runs
  `pnpm db:migrate:prod`). Until then, the new `WHERE i.trashed_at IS NULL` in `fetchReferenceData`
  would fail with 42703 on every page. See `AGENTS.md` → Migrations.
- **Hard delete must go through `payload.delete`, not raw SQL.** That way `beforeDelete`
  (`preventDeleteWithTransactions`) re-checks live transactions inside the delete itself, for both
  the manual delete and the cron.
- **„Realnie użyty" is defined in exactly one SQL fragment.** Both the `/kosz` row label and the
  purge selection read it. If the two could disagree, a row labelled „usunie się samo" might never
  get purged, or the reverse.

---

## Phase 1: Column, hiding, lock

### Overview

Add `trashed_at`. Make a trashed investment invisible on every read surface and refused by every
write gate. Nothing can put an investment in the trash yet, so this phase is safe to land on its
own.

### Changes Required:

#### 1. Migration + collection field

**File**: `src/migrations/20260928_0_investment_trashed_at.ts`, `src/migrations/index.ts`,
`src/collections/investments.ts`

**Intent**: Store when an investment entered the trash. `NULL` means it is live.

**Contract**:

- The migration is hand-written and follows the latest migration's structure: `ALTER TABLE
  investments ADD COLUMN trashed_at timestamptz` (nullable, no default, no index — 65 rows), and
  `down` drops it. Register it in `index.ts`.
- Add a Payload field `trashedAt` (`type: 'date'`, `admin.hidden: true`). It is deliberately **not**
  named `deletedAt`, which is Payload's own trash column.
- Run `pnpm generate:types` afterwards.

#### 2. Reference data chokepoint

**File**: `src/lib/queries/reference-data.ts`

**Intent**: Hide trashed investments from the listing, pickers, dashboard and crumb, and make
`/inwestycje/[id]` and `kosztorys_v2` return 404 through their existing `find → notFound()`.

**Contract**:

- The investments query gets `AND i.trashed_at IS NULL`.
- Extend the comment above it: trashed investments are excluded here, once, for the same reason as
  the szablon.
- Update `src/__tests__/reference-data-sql-drift.test.ts` if it pins the SQL text.

#### 3. The row-by-id pages

**File**: `src/lib/queries/investments.ts` (`requireInvestmentOr404`)

**Intent**: Close the v1 `/kosztorys` page and `/podglad-inwestora/[id]`, which load the row through
`findByID` instead of reference data.

**Contract**: `requireInvestmentOr404` calls `notFound()` when `investment.trashedAt` is set.
`getInvestment`'s cache is already tagged `entityTag('investment', id)`, and phase 2 expires that
tag.

#### 4. Public share read

**File**: `src/lib/queries/preview-kosztorys.ts` (`getPreviewKosztorysByToken`)

**Intent**: Make `/k/<token>` return 404 while the investment is in the trash. The share row is
kept, so the same link works again after a restore.

**Contract**:

- A share whose investment has `trashed_at` set resolves to `null`. That is the same outcome as an
  unknown token, so it leaks nothing.
- The check stays uncached, like the token lookup, so trashing takes effect on the next request.
- Doing it in the token query (a join or a relationship `where`) or in a second indexed SELECT is
  the implementer's choice.

#### 5. Write gate: a second reason to refuse

**Files**: `src/lib/db/investment-gate.ts`, `src/lib/constants/investment-lock.ts`, and every
consumer listed in Key Discoveries.

**Intent**: Refuse every write on a trashed investment, with a sentence that says why. Otherwise a
trashed investment could still take a booking or a kosztorys edit via a direct action call, or via
the transfers hook that `/admin` and the Local API pass through.

**Contract**:

- Replace the gate's boolean with the refusal sentence. `InvestmentGateT` becomes
  `{ lockMessage: string | undefined; templatePresetId: number | null }`.
- `isInvestmentLocked` / `isRelatedInvestmentLocked` become `investmentLockMessage` /
  `relatedInvestmentLockMessage`, each returning `Promise<string | undefined>`.
- Both SELECTs read `trashed_at` next to `status`.
- Precedence: **trashed wins over completed**, because a restore brings back the status the
  investment had before.
- Add `INVESTMENT_TRASHED_MESSAGE` = „Inwestycja jest w koszu — przywróć ją, żeby coś zmienić." to
  `constants/investment-lock.ts`. That file must stay free of `server-only`.
- Consumers return or throw the message they receive, instead of the hard-coded
  `INVESTMENT_LOCKED_MESSAGE`. `access/investment-lock.ts` compares against `undefined`.
- Update the docblocks that say "completed" to say "completed or trashed".
- `transfers.tsx:234` (client-side, completed status only) stays as is.

### Success Criteria:

#### Automated Verification:

- The migration applies to the local DB and rolls back: `pnpm payload migrate` then
  `pnpm payload migrate:down`, then migrate again.
- `src/__tests__/lib/db/investment-gate.test.ts`: a trashed investment returns
  `INVESTMENT_TRASHED_MESSAGE`; trashed + completed returns the trashed message; completed-only still
  returns `INVESTMENT_LOCKED_MESSAGE`; a live investment returns `undefined`.
- `src/__tests__/lib/queries/preview-kosztorys-token.test.ts`: a token whose investment is trashed
  resolves to `null`.
- `src/__tests__/reference-data-sql-drift.test.ts` passes with the new predicate.
- Existing gate-consumer specs pass after the rename:
  `pnpm exec vitest run src/__tests__/lib/actions src/__tests__/hooks`.

#### Manual Verification:

- Set `trashed_at = now()` on one local investment by hand. It disappears from `/inwestycje`, from
  the transfer dialog picker and from dashboard sums. `/inwestycje/<id>`, `/kosztorys_v2`,
  `/kosztorys` and `/podglad-inwestora/<id>` all return 404, and so does its `/k/<token>`.
- Reset `trashed_at` to `NULL`. Everything comes back, including the same `/k/<token>`.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Trash, restore, delete forever

### Overview

Add three owner/admin server actions, a shared "realnie użyty" query, and the read that the
`/kosz` page will use.

### Changes Required:

#### 1. `ownerOnlyAction` forwards revalidation

**File**: `src/lib/actions/owner-only-action.ts`

**Intent**: Let the trash actions expire cache tags without hand-copying the role check.

**Contract**: Add optional `revalidate` and `opts` parameters, passed straight through to
`protectedAction`. Existing callers are unchanged.

#### 2. The shared transaction probe

**File**: `src/collections/investments.ts` (plus its new home if extracted)

**Intent**: The trash action must refuse on exactly the same condition, and with exactly the same
sentence, as a hard delete.

**Contract**:

- Export the investment's live-transaction check so it can be called with `(id, req)` outside the
  hook. The `beforeDelete` hook and the trash action then share one definition.
- Where it lives (a named export beside the collection, or `makePreventDelete` exposing its probe
  runner) is the implementer's call. The one invariant: a single `probes` + `message` definition.

#### 3. Trash queries

**File**: `src/lib/db/investment-trash.ts` (new)

**Intent**: The data-access layer for the trash: one SQL fragment for "kosztorys realnie użyty",
reused by the page read, the delete action and the purge.

**Contract**:

- The "used" predicate: `EXISTS (kosztorys_items.planned_qty <> 0)` **OR**
  `EXISTS (stage_progress.qty_done <> 0 via stage_progress.item_id → kosztorys_items.investment_id)`.
  Price, discount, versions and bare items do **not** count.
- `fetchTrashedInvestments(db)` returns `{ id, name, trashedAt, isKosztorysUsed }[]`, newest first.
- `isKosztorysUsed(db, investmentId): Promise<boolean>`.
- `selectPurgeableInvestmentIds(db, olderThanDays)` returns trashed ids with
  `trashed_at < now() - interval` **and** not used.
- `TRASH_RETENTION_DAYS = 30` lives beside these functions.

#### 4. Trash page read

**File**: `src/lib/queries/trash.ts` (new)

**Intent**: The owner/admin read behind `/kosz`.

**Contract**:

- `getTrashedInvestments()` runs `requireAuth(ADMIN_OR_OWNER_ROLES)`, then
  `fetchTrashedInvestments`, then derives `daysLeft` from `trashedAt + TRASH_RETENTION_DAYS`.
- It is uncached: the page is rare, and its "used" flag reads kosztorys tables that no trash tag
  covers.

#### 5. The three actions

**File**: `src/lib/actions/investment-trash.ts` (new, `'use server'`)

**Intent**: The only paths into and out of the trash.

**Contract** — all three use `ownerOnlyAction`, with „Tylko właściciel lub administrator może usuwać
inwestycje." as the forbidden message.

`trashInvestmentAction(investmentId)`:

- Runs inside `withPayloadTransaction`.
- Refuses the szablon („Warsztatu szablonów nie można usunąć.").
- An already-trashed investment returns success (idempotent).
- Runs the shared transaction probe with `req`. On refusal it returns the probe's sentence.
- Otherwise `payload.update` sets `trashedAt: now` with `req`.

`restoreInvestmentAction(investmentId)`:

- Clears `trashedAt`.
- A live investment returns success (idempotent).

`deleteInvestmentForeverAction(investmentId, confirmName?)`:

- Refuses unless the investment is trashed („Najpierw przenieś inwestycję do kosza.").
- If `isKosztorysUsed`, it refuses unless `confirmName` matches `name` after trimming
  („Wpisana nazwa nie zgadza się z nazwą inwestycji."). This is server-side, so the dialog cannot be
  bypassed.
- Then `payload.delete` runs, and `beforeDelete` re-checks transactions.

Revalidation:

| Action | Collections | Entity tags |
| --- | --- | --- |
| trash / restore | `investments`, `kosztoryses`, `leads` | `entityTag('investment', id)` |
| delete forever | trash/restore set + `KOSZTORYS_TREE_TAGS`, `transfers`, `equipmentEvents` | `entityTag('investment', id)` |

The extra collections on delete forever are the cascade children Payload never sees (see lesson).

#### 6. The delete as a reusable function

**File**: `src/lib/investments/delete-investment-forever.ts` (new, `server-only`)

**Intent**: The cron purge (phase 4) and the action must delete the same way. The action adds only
the session and the name check.

**Contract**:

- `deleteTrashedInvestment(payload, investmentId): Promise<{ ok: true } | { ok: false; reason: 'not-trashed' | 'blocked' | 'error'; message: string }>`
  wraps `payload.delete`.
- It maps the `beforeDelete` `APIError` to `blocked`.
- Cache expiry stays with each caller: the action through its wrapper, the cron through
  `revalidateTag(…, EXPIRE_NOW)`, because a Route Handler cannot use `updateTag`.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/db/investment-trash.db.test.ts`, run against 5435. The "used" predicate is true
  for a planned_qty ≠ 0 item, true for a stage_progress qty_done ≠ 0 item, and false for a template
  seed with only price/discount set. `selectPurgeableInvestmentIds` skips used ones and ones younger
  than 30 days.
- `src/__tests__/lib/actions/investment-trash.db.test.ts`:
  - A MANAGER is refused.
  - The szablon is refused.
  - A live transaction refuses trashing, while a cancelled one does not.
  - Trash then restore round-trips `trashed_at`, and the kosztorys row count is unchanged.
  - Delete-forever on a non-trashed investment is refused.
  - Delete-forever on a used investment without the matching name is refused, and with it succeeds.
  - After delete-forever, the investment's `kosztorys_items`, `kosztorys_shares` and
  `stage_progress` rows are gone.

  All assertions check persisted rows, not the action result.
- The action spec (2.2) includes one owner/admin action exercising the forwarded `entityTags` — the shared `cache-revalidate` stub's spy sees `entityTag('investment', id)` on trash.

#### Manual Verification:

- None beyond phase 3. The actions have no UI yet.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: `/kosz` page, nav entry, „Usuń" on the listing

### Overview

Add the UI for the three actions.

### Changes Required:

#### 1. Nav: a third link group

**Files**: `src/lib/constants/sections.ts`, `src/hooks/use-nav-links.ts`

**Intent**: „Kosz" appears last in the sidebar and the mobile nav, for owner/admin only.

**Contract**:

- Add `OWNER_LINKS: NavLinkT[] = [{ href: '/kosz', label: 'Kosz', icon: Trash2 }]`.
- `useNavLinks` appends it when `isAdminOrOwnerRole(user.role)`, after `MANAGEMENT_LINKS`.
- Sidebar and mobile nav already render `links` generically. Confirm that, and change neither.

#### 2. `/kosz` page

**File**: `src/app/(frontend)/kosz/page.tsx` (new), plus components under `src/components/trash/`
(new)

**Intent**: The shared trash page, with one „Inwestycje" section.

**Contract**:

- The page guard is `requireAuth(ADMIN_OR_OWNER_ROLES)` → `redirect('/zaloguj')`, as in
  `raporty/page.tsx`.
- Each row shows the name, the date deleted (Polish date format already used in the app), and
  either „usunie się samo za N dni" or „kosztorys w użyciu — tylko ręcznie".
- Row actions are Przywróć and Usuń na zawsze.
- The empty state is „Kosz jest pusty".
- A plain list is enough. There is no `DataTable` and no filters: few rows, no sorting need.

#### 3. The delete-forever dialog

**File**: `src/components/trash/delete-forever-dialog.tsx` (new)

**Intent**: Typing the name is required only for a used kosztorys.

**Contract**:

- When `isKosztorysUsed` is true, render `FormDialogShell` + `Input` with
  `confirmDisabled = input.trim() !== name`. The shape follows the rename dialog in
  `presets/preset-row-actions.tsx:49-67`.
- The dialog text names what is lost: „kosztorys (pozycje i wersje), przypięcia zdjęć, link dla
  inwestora".
- Otherwise use a plain `ConfirmDialog`.
- It calls `deleteInvestmentForeverAction(id, typedName)`, shows the error toast on failure, and
  calls `router.refresh()` on success.

#### 4. „Usuń" on the listing

**File**: `src/components/tables/investments.tsx` (the `actions` column at `:286-291`)

**Intent**: The entry point into the trash.

**Contract**:

- Next to `<EditInvestmentDialog>`, render a delete button for owner/admin only. It uses the
  `isAdminOrOwner` value already computed at `:87` and the existing `DeleteButton` +
  `ConfirmDialog` pattern (`components/ui/row-actions/`).
- Confirm text: „Przenieść „<nazwa>" do kosza? Możesz ją przywrócić z Kosza."
- It calls `trashInvestmentAction`. A refusal (live transactions) shows the action's sentence as an
  error toast.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/components/trash/delete-forever-dialog.test.tsx` (dom). For a used kosztorys,
  confirm stays disabled until the exact name is typed. For an unused one, confirm is enabled at
  once and no input is rendered. The action is `vi.mock`ed.
- `src/__tests__/hooks/use-nav-links.test.tsx` (dom, new). OWNER and ADMIN see „Kosz"
  last. MANAGER and EMPLOYEE do not.

#### Manual Verification:

- As owner: „Usuń" on an investment without transactions takes it to `/kosz` and shows
  „usunie się samo za 30 dni". On an investment with a live transaction, the toast names the count
  and the investment stays put.
- In `/kosz`: Przywróć brings the investment back to the listing unchanged. Usuń na zawsze on
  investment 157 (used kosztorys, dump 23.09) requires the name. On investment 155 (template only),
  it is a plain confirmation.
- As manager: there is no „Usuń" on the listing, no „Kosz" in the nav, and `/kosz` redirects.
- The mobile nav (< 768px) shows „Kosz" for the owner.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Auto-purge in the cleanup cron

### Overview

Add a second step to `/api/cron/cleanup`: purge unused investments that have been in the trash for
more than 30 days.

### Changes Required:

#### 1. Purge step

**File**: `src/lib/investments/purge-trash.ts` (new, `server-only`)

**Intent**: Empty the trash one investment at a time, so a single failure never blocks the rest.

**Contract**:

- `purgeTrash(payload, db): Promise<{ purged: number; skippedKosztorys: number; blocked: number; failed: number }>`.
- It selects candidates via `selectPurgeableInvestmentIds(db, TRASH_RETENTION_DAYS)` and runs
  `deleteTrashedInvestment` for each one.
- `skippedKosztorys` counts expired but used rows, i.e. the ones the owner must delete by hand.
- `blocked` counts rows that a transaction booked after trashing would pin. The gate makes that
  unreachable, but the result is reported rather than assumed.
- After at least one purge, it expires the same tag set as delete-forever, once, via
  `revalidateTag(tag, EXPIRE_NOW)`.
- Each failure is logged with a `// TODO(EX-449) SENTRY-REQUIRED:` marker.

#### 2. Harden the route

**File**: `src/app/(payload)/api/cron/cleanup/route.ts`

**Intent**: A throw in one step must not hide the other step's result.

**Contract**:

- Each step runs in its own try/catch, following `leads-reconcile/route.ts:45-51`.
- The response becomes `{ ok, snapshots, trash }`. `ok` is false if either step threw, and the
  status is 500 only when both threw.
- Add `export const maxDuration = 300`.
- Update the header comment: the handler now does two sweeps.
- If `kosz-plikow` phase 2 has already hardened this route, reuse its shape instead of adding a
  second one.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/investments/purge-trash.db.test.ts`: an unused investment trashed 31 days ago
  is deleted; a used one is kept and counted in `skippedKosztorys`; an unused one trashed 29 days
  ago is kept. The assertions check persisted rows.
- `src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts` is extended: the response carries
  `trash`, and a throwing `purgeTrash` still returns the `snapshots` result with `ok: false`.

#### Manual Verification:

- Locally, set `trashed_at = now() - interval '31 days'` on one empty trashed investment and call
  `/api/cron/cleanup` with the cron secret. The investment is gone from `/kosz`, and the JSON shows
  `trash.purged: 1`.

**Implementation Note**: This is the final phase. Collect the manual verification bullets into the
registry.

---

## Testing Strategy

The risks are ordered by what it costs if one is missed:

1. **An irreversible delete of a used kosztorys.** Covered by the server-side name check and the
   purge's used-predicate (phase 2 and 4 DB specs).
2. **A trashed investment still taking writes, or still being public.** Covered by the gate and
   token specs (phase 1).
3. **A trashed investment still visible or counted.** Covered by the refData predicate (phase 1).

The browser-level flow (listing → trash → restore → delete forever) owes an E2E. It is deferred to a
Linear issue labelled `e2e-backlog` in project "Wykonczymy", filed at the review gate.

## Performance Considerations

None of note. The new predicate adds one column check to a 65-row query. The "used" query runs per
trashed row on a page with a handful of rows. The purge deletes at most a few investments per day.

## Migration Notes

The migration is additive. **Prod migrates before the push** (human: `pnpm db:migrate:prod`), then
the code ships. Existing rows get `trashed_at NULL`, so everything stays live. There is no backfill.

## Whole-tree Gate

- Types regenerate and typecheck passes: `pnpm generate:types && pnpm typecheck`
- Lint passes: `pnpm lint`
- Full unit + DOM suite passes: `pnpm test`
- DB integration specs pass: `pnpm test:integration`
- Build succeeds: `pnpm build`

## References

- Decisions: `context/changes/2026-09-24-kosz-inwestycji/change.md`
- Research (read paths, gates, cascades, cron): `context/changes/2026-09-24-kosz-inwestycji/research.md`
- Gate pattern: `src/lib/db/investment-gate.ts`, `src/lib/actions/investment-action.ts:78`
- Delete probe: `src/hooks/prevent-delete.ts`, `src/collections/investments.ts:24`
- Cron partial-failure pattern: `src/app/(payload)/api/cron/leads-reconcile/route.ts:45-51`
- Type-to-confirm precedent: `src/components/presets/preset-row-actions.tsx:49-67`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Column, hiding, lock

#### Automated

- [x] 1.1 Migration applies and rolls back on local DB — 719e37c6
- [x] 1.2 investment-gate spec covers trashed / trashed+completed / completed / live — 719e37c6
- [x] 1.3 preview-kosztorys-token spec: trashed investment's token resolves to null — 719e37c6
- [x] 1.4 reference-data SQL drift spec passes with trashed predicate — 719e37c6
- [x] 1.5 Gate-consumer specs pass after the lock-message rename — 719e37c6

### Phase 2: Trash, restore, delete forever

#### Automated

- [x] 2.1 investment-trash DB spec: used predicate + purgeable selection — 353c205b
- [x] 2.2 investment-trash actions DB spec: roles, szablon, transactions, round-trip, name check, cascade — 353c205b
- [x] 2.3 trash action expires entityTag('investment', id) through ownerOnlyAction — 353c205b

### Phase 3: `/kosz` page, nav entry, „Usuń" on the listing

#### Automated

- [x] 3.1 delete-forever-dialog DOM spec: name required only for used kosztorys
- [x] 3.2 use-nav-links DOM spec: „Kosz" only for owner/admin, last

### Phase 4: Auto-purge in the cleanup cron

#### Automated

- [ ] 4.1 purge-trash DB spec: 31d unused purged, used skipped, 29d kept
- [ ] 4.2 cleanup route spec: trash result reported, one failing step does not hide the other
