# Worker work reports — slice 1 (EX-947) Implementation Plan

## Overview

A worker gets a second named link, „Link do zgłoszeń”, and uses it to report the quantities he
executed, from his phone or a desktop. The report page is the spike's rozpiska grid with one
„Zgłaszam” column, plus prace spoza rozpiski. A sent report is stored frozen.

A kierownik reviews it in the rozpiska, ticks lines, and may correct quantities. He then picks
where the lines go (an etap of that worker, or „Nowy etap”) and accepts. Accepted quantities are
**added** to the etap; accepted prace spoza rozpiski become new pozycje bez przedmiaru.

Pending reports surface:

- in a main-nav entry „Zgłoszenia prac” with a count;
- in the rozpiska toolbar button;
- in the „Pracownicy” menu.

Owner decisions 1–25 in `change.md` are authoritative. `research.md` §1–7 is the code map.

## Current State Analysis

- **The UI is built and approved as a spike, but runs on localStorage.** Four seams stand in for
  the server:
  - `worker-report/spike-report-store.ts` (the reports table);
  - `dialogs/worker-reports/sample-report.ts`;
  - `dialogs/worker-reports/use-pending-report-count.ts`;
  - the session-guarded `app/(share)/zgloszenie-prac/[worker]/[id]/page.tsx`.

  Everything else in the spike is real UI to keep: the form, the grid, the review tables,
  `line-draft.ts`, `report-column.tsx`, `grid-min-width.ts`, and the css blocks.

- **The worker link machinery already exists.** It lives in:
  - `kosztorys-worker-shares` + `share-token.ts`, which rotate the token, handle races and delete;
  - `generateWorkerShareLinkAction`, which refuses a blocked `resolveWorkerScope`;
  - `getWorkerKosztorysByToken` (`queries/worker-kosztorys.ts:135-154`), an uncached lookup with
    `overrideAccess` that excludes trashed investments;
  - the „Pracownicy” menu's `WorkerShareMenuItem` → `ShareLinkPanel`
    (`editor/actions/worker-actions.tsx:69,89,144`).
- **Stage quantities are absolute.** `setStageProgressAction` (`lib/actions/kosztorys.ts:766-791`)
  upserts `qty_done = value` behind a debounced per-cell lane. There is no additive write and no
  `src/lib/db` helper for `stage_progress`.
- **Creating an etap with one worker at 100% is already one transaction**
  (`addStageAction` :600-651, `oneWorkerSplit` in `lib/kosztorys/stage-split.ts:63-65`,
  `insertStageMembers` in `lib/db/stage-split.ts:34-48`). New pozycje with prefilled fields follow
  `placeCatalogueItems` → `insertItems` (`work-catalogue/place-catalogue-items.ts:26-93`).
- **The editor's `rows` are a mount-time snapshot** (lesson ~165). Two mechanisms exist for
  mid-session change:
  - `patchRows` (`use-kosztorys-editor.ts:1229-1238`), with `pruneByIds` for undo;
  - `handleAppendedCatalogueItems` (:1045-1066).

  Only `handleAddStage` adds an etap, so nothing adopts a server-made one. Nothing detects that
  another window changed the tree.

- **Every non-login path redirects to login except two prefixes.** `src/proxy.ts:14` passes only
  `/k/` and `/p/`.
- **Nav badges are unread cursors** (`fetchUnreadCounts`, `UnreadCountsT`). `UnreadBadge` zeroes
  on a bare `pathname.startsWith(path)` (`nav/unread-badge.tsx:28`).

## Desired End State

- **Minting the report link.** The „Pracownicy” menu offers „Link do zgłoszeń” per worker, beside
  his rozpiska link. It is minted, copied and revoked the same way, and refused under the same
  blocked scope (#21).
- **The worker's page.** `/zgloszenie-prac/⟨nazwisko⟩/⟨token⟩` opens without a session and shows:
  - the rozpiska grid with „Zgłaszam”;
  - prace spoza rozpiski;
  - his sent reports with status czeka / przyjęte / odrzucone (#19).

  The szkic lives in localStorage keyed by investment + worker. On load it drops lines whose
  pozycja vanished, with the notice „N pozycji ze szkicu zniknęło z rozpiski” (#24).

- **Refusals.** A blocked scope, an inactive worker, a revoked token, a zakończona or trashed
  investment each show a notice instead of the form, or refuse the send (#21, #22).
- **Storing a send.** „Wyślij do weryfikacji” stores the report in two raw tables. Opis, j.m. and
  sekcja are copied onto each line.
- **Where a kierownik sees pending reports.** He sees the count:
  - in the nav's „Zgłoszenia prac” (`/zgloszenia-prac`), which lists pending reports across
    investments;
  - on the toolbar button „Zgłoszenia prac (n)”;
  - in the „Pracownicy” menu.

  An entry deep-links to `/inwestycje/⟨id⟩/kosztorys_v2?zgloszenie=⟨id⟩` with the report open.

- **Accepting.** One transaction:
  - adds the ticked quantities to the chosen etap (his own, or a new one assigned to him at 100%);
  - creates ticked prace spoza rozpiski as new pozycje;
  - records the per-line accepted qty and the decision.

  An auto version is saved first. The accepting window patches itself in place and drops undo for
  the touched pozycje. Any other open window reloads its tree on focus (#25).

- **Rejecting and history.** Rejecting records the decision. Decided reports reopen read-only.
- **Lines that lost their pozycja.** A pending report whose pozycja vanished shows that line as
  „do przypisania ręcznie”. The kierownik re-points it to a pozycja, with a suggestion by opis + j.m.,
  or treats it as a praca spoza rozpiski (#14).
- **Layout.** At ≥768px, „Ograniczona rozpiska” shows the Lp gutter and j.m.; a phone keeps
  Opis prac + „Zgłaszam”.
- **Docs.** They record the report tables as the first outside referrer of an item id, and the
  phone-scope exception.

Verify with the per-phase specs, `pnpm test:integration` (DB specs vs 5435), and the manual checks
rolled into `context/foundation/manual-checks.md`.

### Key Discoveries

- `investmentAction` runs the lock gate **outside** any transaction. Acceptance must re-gate
  inside its own with `lockInvestmentGates(tx, [inv])` (`lib/db/investment-gate.ts:75-90`); that
  also serialises two acceptances on one investment.
- **An `INSERT … ON CONFLICT DO UPDATE` that touches one row twice is a Postgres error (21000).**
  Sum accepted qty per pozycja before the upsert.
- **`runNow` cancels a pending autosave instead of flushing it** (`hooks/use-debounced-save.ts:76-82`).
  `save-lanes.ts` (:20-22) has no wait-until-idle, so an absolute cell write still in flight can
  land after the addition and erase it. Acceptance needs a `drain(keys)`.
- **`rowsFromSections` (:1019-1033) reads `stages` from the closure and hard-codes `progress: []`.**
  Rows appended in the same tick as a new etap miss its key. Queue in order: adopt etap → append
  rows → patch cells.
- **A plain cell edit does not bump `investments.updated_at`** (`investment-action.ts:85-88`). So
  a changed `tree.revision` (`lib/kosztorys/types.ts:157`) means a structural or external write.
  That makes a focus-time revision check a precise "someone else changed this" signal.
- **„Cena j.m.” for a praca spoza rozpiski is `client_price`.** The worker's rate is derived
  (`calc.ts:185-194`: an override, else `clientPrice ×` the investment coefficient), so both
  override pairs stay null.
- **A new etap's plane is the worker's** (`resolveWorkerScope(...).plane`, `worker-view/scope.ts:18-31`).
  After #20, he may have no etap left. Then the dialog asks for a plane; the server refuses any
  plane that would make his scope `mixed-planes`.
- **`WORKER_KOSZTORYS_TAGS`** (`queries/worker-kosztorys.ts:23-32`) already include
  `stageProgress` / `kosztorysStages` / `kosztorysItems`. Acceptance's tags therefore refresh his
  rozpiska link too.
- **The shared `KosztorysActionsProvider` is `editor/actions/kosztorys-actions-context.tsx`.** The
  toolbar's `WorkerReportsButton` sits outside it (toolbar :105) and must move inside.
- **dsg sizes columns in JS**, so `max-sm:hidden` cannot hide a column. The repo has no media-query
  hook (`matchMedia` exists only in `__tests__/setup/dom.ts`).
- **Tests.** `test-plan.md` has no risk for a public token **write** surface. The nearest are the
  server-boundary gating risk (#6) and the share-leak risk (#12). Extend it with `/10x-test-plan`
  before Phase 2's specs.
- **The spike's own fixes ride with this change** (owner, 2026-09-30: reviewed together, not
  committed ahead). This covers the "no red on investor/worker documents" work: `isDocument` in
  `kosztorys-v2-columns.tsx`, `subcontractor/cell-data.ts`, `price-cell.tsx`, the
  `section-header-cell.tsx` `isBare` band, `document-alarms.test.tsx`, and the trimmed
  `remaining-overrun-tone.test.ts`. It lands in Phase 5's commits.

## What We're NOT Doing

- **Server-side szkic** (#23): it stays in localStorage.
- **Worker withdraw or edit of a sent report** (#19).
- **Hardening the token surface** (#13): no rate limit or captcha.
- **Mail or push notifications** (#4): badge only.
- **Reports on a Google-Sheet investment** (#6).
- **Slices 2–3** (EX-948, EX-949): Ukrainian translations, paper → AI.
- **Stable ids across a restore.** A lost pozycja is re-pointed by hand (#14).
- **Pulling the report out of the shared editor body.** The grid is inline in a 741-line body that
  reads ~40 hook values. A report component built from shared parts first needs a
  `KosztorysSheetGrid` extracted, and that touches the investor, worker and editor pages. It is a
  refactor of its own. This plan keeps the single `report` prop and collapses the hook's three
  branches into neutral seams (Phase 5). File the extraction to Linear at implement time.
- **Keeping a report's „Przyjęte” consistent with a later version restore.** Restoring the pre-accept
  auto version removes the added quantities while the report still reads „Przyjęte”. This is
  accepted, and recorded in the domain notes.
- **A compare-and-set on `setStageProgressAction`.** Other windows are handled by the focus-time
  revision check instead, so the editor's most frequent write stays untouched.

## Implementation Approach

1. **Storage first.** Migration, raw-SQL layer, the second share collection, and the user-delete
   probe. Nothing reads it yet.
2. **The worker's side end to end.** Report link minting, `tokenAction`, the public route, the send,
   the status list, the szkic prune. After this phase a real report lands in the DB.
3. **The kierownik's side.** Server reads, reject, accept, and the editor's in-place adoption plus
   the other-window reload. The spike store is deleted here.
4. **Surfacing.** Nav page and count, the badge prefix fix, the deep link, and the dialog toggle
   into `KosztorysActionsProvider`.
5. **Owed layout and seams.** Media-query hook, Lp gutter + j.m. at ≥768px, the hook's report
   branches as seams, dead `desktopOnly` meta.
6. **Living docs.**

## Critical Implementation Details

**Deploy order.** The migration is additive (new tables plus one collection table), so a human runs
`pnpm db:migrate:prod` **before** the push. No old code reads the new tables.

**Acceptance write order.** Everything below runs inside one `withPayloadTransaction`:

1. `lockInvestmentGates`.
2. `UPDATE worker_reports SET status='accepted' … WHERE id AND investment_id AND status='pending'
RETURNING worker_id`. Zero rows means refuse; this is also the double-click guard.
3. Validate the pozycje and the target (see the security note below).
4. `captureAutoSnapshot(tx, …)` — **before** any tree write, so the saved version is the
   pre-accept state.
5. Create the new etap, if any: `MAX(ordinal)+1`, its plane, and `insertStageMembers(oneWorkerSplit)`.
6. Insert the extras, via `sectionOwnerAndNextItemOrder` + `insertItems`.
7. The additive upsert, summed per pozycja:
   `qty_done = stage_progress.qty_done + EXCLUDED.qty_done RETURNING item_id, stage_id, qty_done`.
8. Update the lines: accepted qty, `created_item_id`, re-pointed `item_id`. Update the report
   target with its copied ordinal and label.
9. Bump `investments.updated_at` and return the new revision.

Never snapshot outside the transaction (lesson ~260).

**The accepting window.** Order matters:

1. `flushUndoBuffer()`.
2. `drain` the lanes of every `(item, targetStage)` cell touched.
3. Call the action.
4. On success:
   - adopt the new etap;
   - append the new rows;
   - `patchRows` each touched cell to the **absolute** `qty_done` the server returned;
   - `pruneByIds(touched item ids)`;
   - adopt the returned revision, so the window doesn't reload itself.

An addition is never re-applied client-side: the server figure is the truth.

**Other windows.** On `visibilitychange` → visible (and on `focus`), read `investments.updated_at`
with a small uncached `'use server'` query in `src/lib/queries`. If it differs from the loaded
revision, reseed through the existing remount path (`onTreeReplaced` in `kosztorys-editor-v2.tsx`),
with a toast saying the rozpiska was changed elsewhere. This covers acceptance and every other
structural external write.

**`tokenAction` security.** The token is the whole credential. The handler receives
`{payload, db, investmentId, workerId}` from the token lookup, never from the client. Check order:

1. The uncached token lookup (404 → refuse).
2. `investmentGateFor`: zakończona, trashed or szablon is refused.
3. `users.active` + `resolveWorkerScope` ready.
4. Every `itemId` belongs to `investmentId`.

The kierownik's accept / reject stays on `investmentAction` and does **not** re-check the worker
(#20). The report id is scoped by `investment_id` in every statement. The target etap must belong to
the investment and have the reporting worker as a member (#16).

**Floating point.** Reported and accepted qty are `numeric`. Use `parseReportQty` on input and
refuse ≤ 0. The upsert sums in SQL, so no client rounding reaches the stored figure.

## Phase 1: Storage

### Overview

Tables, the raw-SQL layer, the report-link collection, and the delete guard. No reads from the app
yet.

### Changes Required

#### 1. Migration

**File**: `src/migrations/20260930_2_add_worker_reports.ts` (new), registered in `src/migrations/index.ts`

**Intent**: Create the two report tables and the `worker_report_shares` collection table. Hand-write
it: copy `20260930_1_add_kosztorys_stage_workers.ts` for the raw tables, and
`20260928_1_kosztorys_worker_view.ts` for the share collection. The collection also needs its
`payload_locked_documents_rels` column plus FK and index, timestamps and their indexes, and the
`investment_id` / `worker_id` FKs with a unique `(investment_id, worker_id)`.

**Contract**:

```
worker_reports(
  id serial PK,
  investment_id int NOT NULL → investments ON DELETE CASCADE,
  worker_id int NOT NULL → users ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK IN ('pending','accepted','rejected'),
  sent_at timestamptz(3) NOT NULL DEFAULT now(),
  decided_at timestamptz(3), decided_by int → users ON DELETE SET NULL,
  target_stage_id int → kosztorys_stages ON DELETE SET NULL,
  target_stage_ordinal int, target_stage_label varchar,
  CHECK ((status = 'pending') = (decided_at IS NULL))
)
idx (investment_id, sent_at DESC); idx (worker_id, investment_id, sent_at DESC);
partial idx (investment_id) WHERE status = 'pending'

worker_report_lines(
  id serial PK,
  report_id int NOT NULL → worker_reports ON DELETE CASCADE,
  position int NOT NULL,
  kind text NOT NULL CHECK IN ('rozpiska','extra'),
  item_id int → kosztorys_items ON DELETE SET NULL,
  description text NOT NULL, unit varchar NOT NULL, section_name varchar,
  reported_qty numeric NOT NULL CHECK (reported_qty > 0),
  accepted_qty numeric CHECK (accepted_qty > 0),   -- NULL on a decided report = rejected line
  created_item_id int → kosztorys_items ON DELETE SET NULL,
  catalogue_item_id int → work_catalogue_items ON DELETE SET NULL
)
idx (report_id), (item_id), (created_item_id)
```

The status is `text` + `CHECK`, not a Postgres enum: nothing in Payload owns it, and a CHECK is
cheaper to extend. Index every FK into the tree. Without that, a 1000-item restore scans the lines
table once per deleted item.

#### 2. Report-link collection

**File**: `src/collections/worker-report-shares.ts` (new), registered in `payload.config.ts`

**Intent**: A mirror of `kosztorys-worker-shares`: same fields and access, no `kind` column. The
token alone decides the view.

**Contract**: slug `worker-report-shares`; fields `investment`, `worker`, `token` (unique).

#### 3. Report data-access layer

**File**: `src/lib/db/worker-reports.ts` (new)

**Intent**: Single statements plus their row mappers, per the `src/lib/db` rule. Orchestration
lives in `lib/actions`.

**Contract**:

- `insertWorkerReport(db, {investmentId, workerId, lines}) → id`: report plus lines in one
  statement pair; the caller supplies the transaction.
- `listWorkerReports(db, investmentId)`
- `listWorkerReportsForWorker(db, investmentId, workerId)`
- `readWorkerReport(db, investmentId, reportId)`
- `countPendingByInvestment(db) → {investmentId, investmentName, count, oldestSentAt}[]`
- `countPendingReports(db) → number`
- `pendingQtyByItem(db, investmentId, workerId) → Map<itemId, qty>`: feeds the form's
  „Zgłoszono”, per change.md spike 2.
- `claimPendingReport(db, investmentId, reportId, status, userId) → workerId | null`: the guarded
  `UPDATE … WHERE status='pending'`.
- `updateReportLines(db, …)`
- `setReportTarget(db, …)`
- `countReportsByWorker(db, workerId)`

**File**: `src/lib/db/stage-progress.ts` (new)

**Contract**: `addStageProgress(db, investmentId, stageId, qtyByItem: Map<number, number>) →
{itemId, stageId, qtyDone}[]`. It is additive, with one row per item (the map guarantees that),
and is guarded by `stage_id` belonging to `investmentId`. Unlike `setStageProgressAction`, the
investment check is not omitted.

#### 4. Worker delete guard

**File**: `src/collections/users.ts` (beside `countStageMemberships` :56), probe in `src/lib/db/worker-reports.ts`

**Intent**: Refuse deleting a user a report names. The `ON DELETE CASCADE` is only a backstop.

#### 5. Tree writers stay blind to the report tables

**File**: `src/__tests__/lib/kosztorys/insert-schema-drift.test.ts`

**Intent**: This spec pins the columns the tree INSERT knows about. Add an assertion that restore
does not delete from `worker_reports` / `worker_report_lines`: the lines' `item_id` goes NULL, and
the report survives. No code change in `restore-kosztorys.ts` or `insert-kosztorys-tree.ts`; the
FK `ON DELETE SET NULL` does it.

### Success Criteria

#### Automated Verification:

- The migration applies to the local dev DB and the 5435 test DB (`pnpm payload migrate`), after
  `git status src/migrations` shows only this change's file.
- `pnpm generate:types` succeeds with the new collection.
- DB spec `src/__tests__/lib/db/worker-reports.test.ts`: insert + read round-trip; the
  `pending`/`decided_at` CHECK refuses a mixed row; `claimPendingReport` returns null the second
  time; `pendingQtyByItem` sums only pending reports of that worker.
- DB spec `src/__tests__/lib/db/stage-progress.test.ts`: `addStageProgress` adds to an existing
  cell, creates a missing one, and refuses an etap of another investment.
- DB spec: a kosztorys restore leaves the report and its lines, with `item_id` NULL.
- DB spec: deleting a user a report names is refused.

#### Manual Verification:

- None; there is no UI in this phase.

---

## Phase 2: The worker's side

### Overview

Report link minting, `tokenAction`, the public route, sending, status, and the szkic prune.

### Changes Required

#### 1. Second share kind

**File**: `src/lib/kosztorys/share-token.ts`, `src/lib/actions/worker-report-share.ts` (new),
`src/lib/utils/…` (URL builder beside the worker share URL)

**Intent**: Add a `workerReportShare` member to `ShareRowT`, so `writeShareToken` / `deleteShare`
serve both collections. Add generate / revoke actions that reuse the rozpiska link's
`resolveWorkerScope` refusal (#21), a token-read endpoint, and a `workerReportShareUrl(name, token)`
builder.

**Contract**: `generateWorkerReportLinkAction(investmentId, workerId)` and
`revokeWorkerReportLinkAction(investmentId, workerId)` both return `ActionResultT<{url}>`. The URL
is `/zgloszenie-prac/⟨slug nazwiska⟩/⟨token⟩`.

#### 2. „Link do zgłoszeń” in the „Pracownicy” menu

**File**: `src/components/kosztorys/editor/actions/worker-actions.tsx`, `toolbar/menus/kosztorys-workers-menu.tsx`

**Intent**: A second per-worker entry, beside the rozpiska link, driving the same `ShareLinkPanel`
with its own title and copy. `useWorkerActions` gets a `kind` on its share target rather than a
second state. The live link-holders read unions both collections, so a worker who holds only a
report link after unassignment is still listed.

#### 3. `tokenAction`

**File**: `src/lib/actions/run-action.ts` (shared private tail), `src/lib/actions/token-action.ts` (new)

**Intent**: The public-surface twin of `protectedAction`. It extracts the perf / try-catch /
`toActionFailure` / revalidate tail into one private helper that both wrappers call. Check order
and the context contract are in Critical Implementation Details.

**Contract**:
`tokenAction<T>(label, token, handler: (ctx: {payload, db, investmentId, workerId}) => Promise<T>, revalidate?) → ActionResultT<T>`.
A refusal returns `{success:false, error}` with a Polish sentence, never a throw.

#### 4. Send action

**File**: `src/lib/actions/worker-report.ts` (new, `'use server'`)

**Intent**: `sendWorkerReportAction(token, lines)`. It validates with zod:

- a rozpiska line has an `itemId` and qty > 0;
- an extra has opis, a j.m. from `unit-options`, and qty > 0;
- at least one line.

It then copies opis / j.m. / sekcja from the live pozycja server-side (never from the client) and
inserts. There are no cache tags: report reads are uncached.

#### 5. Public route

**File**: `src/app/(share)/zgloszenie-prac/[name]/[token]/page.tsx` (replaces the spike's
`[worker]/[id]` route, which is deleted), `src/lib/queries/worker-report.ts` (new),
`src/proxy.ts`

**Intent**: The page does the following:

- resolves the token with an uncached lookup that mirrors `getWorkerKosztorysByToken`;
- 404s on an unknown token;
- renders the notice instead of the form for a blocked scope, an inactive worker, or a
  zakończona / trashed investment;
- otherwise renders `WorkerReportForm` from the same preview data the spike used, plus this
  worker's pending qty per pozycja and his sent reports.

`proxy.ts` allowlists `/zgloszenie-prac/`. Otherwise the page **and** its Server Action POST are
redirected to login.

#### 6. Send bar, status list, szkic prune

**File**: `src/components/kosztorys/worker-report/send-bar.tsx`, `use-report-draft.ts`,
new `sent-reports.tsx`

**Intent**:

- **Send bar.** Calls `sendWorkerReportAction`. It clears the szkic only on success, shows a
  pending state, and maps errors to a toast.
- **Status list.** Shows his reports, newest first: date, line count, czeka / przyjęte (n z m) /
  odrzucone (#19).
- **Szkic prune.** `use-report-draft` keys on investment + worker, and on load drops lines whose
  `itemId` is absent from the rozpiska, with the #24 notice. Fix its stale comment: the szkic stays
  in the browser.
- **„Zgłoszono”.** Reads the server's `pendingQtyByItem` instead of the spike store.

#### 7. Test plan

**File**: `context/foundation/test-plan.md` via `/10x-test-plan`

**Intent**: Add the public token write surface as a risk: a revoked, foreign or zakończona token
must never write; an `itemId` from another investment is refused.

### Success Criteria

#### Automated Verification:

- Unit spec `src/__tests__/lib/actions/token-action.test.ts`, one refusal per gate:
  - unknown token;
  - revoked token;
  - zakończona investment;
  - trashed investment;
  - inactive worker;
  - blocked scope;
  - an `itemId` of another investment.

  None of them calls the handler.

- DB spec `src/__tests__/lib/actions/worker-report.test.ts`: a send stores copied opis / j.m. /
  sekcja from the live pozycja even when the client sends different text; zero lines and qty ≤ 0
  are refused.
- DOM spec `src/__tests__/components/kosztorys/worker-report/use-report-draft.test.tsx`: a szkic
  line whose pozycja is gone is dropped on load and counted in the notice.
- Unit spec: `proxy` passes `/zgloszenie-prac/x/y` without a cookie.

#### Manual Verification:

- „Pracownicy” → a worker → „Link do zgłoszeń”: generate, copy, revoke. It is refused for a worker
  without an etap.
- Open the link in a private window at phone width (390px). The form shows, typing survives a
  reload, and „Wyślij do weryfikacji” stores the report and clears the szkic. The report then shows
  as „czeka”.
- On a zakończona investment the link shows the notice, and a send from an already-open page is
  refused.
- After „Wyczyść kosztorys”, a szkic with lines shows „N pozycji ze szkicu zniknęło z rozpiski”.

---

## Phase 3: The kierownik's side

### Overview

Server reads, reject, accept, and the editor's in-place adoption plus the other-window reload.

### Changes Required

#### 1. Reads

**File**: `src/lib/queries/worker-reports.ts` (new, `'use server'` reads)

**Intent**: Uncached, management-gated reads for the dialog: the report list for an investment and
one report with its lines. They map DB rows onto `WorkerReportT`.

#### 2. Report types follow the schema

**File**: `src/lib/kosztorys/worker-report/types.ts`, `dialogs/worker-reports/line-draft.ts`

**Intent**: Align the spike types with the schema:

- `id` becomes a number;
- line kind `'manual'` becomes `'extra'`;
- decisions are keyed by line id;
- add `decidedBy`;
- `target` carries the copied ordinal;
- a rejected line is `acceptedQty: null`;
- a line with `itemId === null` on a pending report is `'unassigned'` (#14).

#### 3. Reject and accept actions

**File**: `src/lib/actions/worker-report.ts`

**Intent**:

- `rejectWorkerReportAction(investmentId, reportId)` runs `claimPendingReport` with
  `'rejected'` and no tree write.
- `acceptWorkerReportAction` follows the write order in Critical Implementation Details.
- Both go through `investmentAction`.

**Contract**:

```ts
acceptWorkerReportAction({
  investmentId, reportId,
  target: { kind: 'stage'; stageId } | { kind: 'new'; plane?: PlaneT },
  lines: { lineId; acceptedQty; itemId? }[],          // itemId only for a re-pointed #14 line
  extras: { lineId; acceptedQty; sectionId; clientPrice?; catalogueItemId? }[],
}) → ActionResultT<{
  stage?: KosztorysStageT,                             // when target was 'new'
  appended: { section, items }[],                      // new pozycje, shaped for handleAppendedCatalogueItems
  cells: { itemId; stageId; qtyDone }[],               // absolute figures after the addition
  revision: string,
}>
```

Tags: `kosztorysStages`, `stageProgress`, `kosztorysItems`, `investments`. Do **not** pass
`deferRefresh`: the nav count must drop right away.

Refusals, in the owner's register:

- the report is no longer pending;
- a target etap without this worker (#16);
- a plane that would mix his rozliczenia;
- a ticked extra without a price or katalog wpis;
- a `unassigned` line accepted without a pozycja.

When the catalogue swap is used, re-read the katalog wpis by id server-side and copy it as `asItem`
does (the precedent is `insertCatalogueItemsAction`).

#### 4. Lane drain

**File**: `src/lib/kosztorys/save-lanes.ts`

**Intent**: `drain(keys): Promise<void>` resolves once every listed lane's tail has settled.
Pending debounced timers for those keys are flushed (fired), not cancelled.

#### 5. Editor adoption

**File**: `src/components/kosztorys/editor/hooks/use-kosztorys-stage-ops.ts`,
`use-kosztorys-editor.ts`, new leaf hook `editor/hooks/use-worker-report-acceptance.ts`

**Intent**: Implement the accepting-window sequence from Critical Implementation Details as one
leaf hook (per the EX-521 rule), exposing `acceptReport(input)` / `rejectReport(id)`. Stage-ops
gains `adoptStage(stage)`, which mirrors `handleAddStage` without a server call. Nothing goes into
`KosztorysEditorProvider`.

#### 6. Other-window reload

**File**: `src/lib/queries/kosztorys-revision.ts` (new), `src/components/kosztorys/editor/hooks/use-external-change-reload.ts` (new),
wired in `kosztorys-editor-v2.tsx`

**Intent**: On visibility → visible, compare the investment's revision with the loaded tree's. On a
mismatch, reseed via `onTreeReplaced` with the toast „Rozpiska zmieniła się w innym oknie —
wczytano aktualną wersję.” The accepting window updates its loaded revision from the action's
result.

#### 7. Review dialog on server data

**File**: `dialogs/worker-reports/worker-reports-dialog.tsx`, `worker-report-review.tsx`,
`review-lines-table.tsx`, `worker-reports-list.tsx`; delete `sample-report.ts` and
`worker-report/spike-report-store.ts`

**Intent**:

- **Server data.** The dialog reads on open; accept / reject call the hook.
- **Target options.** Only the reporting worker's etapy plus „Nowy etap” (#16), and a plane pick
  when he has no etap left.
- **Lines that lost their pozycja.** A pending line whose pozycja is gone renders „do przypisania
  ręcznie”, with a pozycja picker preselected by an exact opis + j.m. match. It can also be moved
  to „Spoza rozpiski”.
- **Decided reports** reopen read-only, showing who decided and when.
- Drop the spike toast.

### Success Criteria

#### Automated Verification:

- DB spec `src/__tests__/lib/actions/accept-worker-report.test.ts`:
  - an accept **adds** to an existing etap figure;
  - two lines for one pozycja are summed and do not error;
  - „Nowy etap” gets the next number, the worker's plane, and him at 100%;
  - an extra becomes a pozycja bez przedmiaru with `client_price` set;
  - a second accept of the same report is refused and changes nothing;
  - a target etap without the worker is refused;
  - an auto version is written and holds the **pre**-accept figures;
  - a forced mid-transaction throw leaves the report pending and the tree and the snapshot table
    unchanged.
- Unit spec `src/__tests__/lib/kosztorys/save-lanes.test.ts`: `drain` waits for an in-flight write,
  and for a pending debounced one, which it fires rather than drops.
- DOM spec `src/__tests__/components/kosztorys/editor/hooks/use-worker-report-acceptance.test.tsx`
  (`renderHook`, action mocked): the new etap is adopted before rows are appended and cells are
  patched to the server's absolute figures; undo no longer holds the touched pozycje.
- DOM spec: `use-external-change-reload` reseeds on a changed revision and not on an equal one.

#### Manual Verification:

- Open a sent report from „Pracownicy” → „Zgłoszenia prac”. Tick some lines, correct one quantity,
  „Dodaj do” his latest etap → „Przyjmij n pozycji”. The etap column shows the old figure plus the
  accepted one without a reload, and Cofnij does not undo it.
- Accept into „Nowy etap”: a new etap column appears, assigned to the worker at 100%, and his
  rozpiska link shows the new figures.
- Accept a praca spoza rozpiski with a Cena j.m.: a new pozycja bez przedmiaru appears in the chosen
  sekcja.
- With a second tab open on the same rozpiska, accept in the first. Switching to the second reloads
  it with the toast.
- Reject a report: it reopens read-only as „Odrzucone”, and the worker's page shows „odrzucone”.
- After „Wyczyść kosztorys” with a report pending, its lines show „do przypisania ręcznie” and can
  be re-pointed.

---

## Phase 4: Surfacing — nav, count, deep link

### Overview

The kierownik finds pending reports from anywhere.

### Changes Required

#### 1. Pending count in the shell

**File**: `src/lib/queries/unread-counts.ts`, `src/types/notifications.ts`, `src/hooks/use-unread-counts.ts`

**Intent**: Add `workReports` (the pending count) to what the shell streams. It is a queue, not a
cursor, so there is no seen epoch and it does **not** zero on its own page. `UnreadBadge` takes a
`zeroOnOwnPage` distinction by stream. The count is read with the existing un-awaited
`fetchUnreadCounts`.

#### 2. Badge prefix boundary

**File**: `src/components/nav/unread-badge.tsx`

**Intent**: Match `pathname === path || pathname.startsWith(path + '/')`, the same boundary as
`isActiveLink` (`use-nav-links.ts:10-12`). Otherwise `/zgloszenia-prac` zeroes the leads badge.

#### 3. Nav entry and page

**File**: `src/lib/constants/sections.ts` (`PAGE_TITLES.workReports = 'Zgłoszenia prac'`, a
`MANAGEMENT_LINKS` entry `/zgloszenia-prac` with the stream),
`src/app/(frontend)/zgloszenia-prac/page.tsx` + `loading.tsx` (`TitledPageLoading`, per EX-877)

**Intent**: A shared `DataTable` of pending reports across investments: inwestycja, pracownik,
wysłano, pozycji. Rows link to the deep link. `requireManagementPage`. The read is uncached.

#### 4. Deep link and shared dialog toggle

**File**: `editor/actions/kosztorys-actions-context.tsx`,
`toolbar/worker-reports-button.tsx`, `toolbar/kosztorys-editor-toolbar.tsx`,
`toolbar/menus/kosztorys-workers-menu.tsx`, `kosztorys_v2/page.tsx`; delete
`dialogs/worker-reports/use-pending-report-count.ts`

**Intent**:

- **One dialog.** The dialog toggle, and its selected report id, move into
  `KosztorysActionsProvider`, so the toolbar button, the menu and the deep link open one dialog
  instance.
- **Button placement.** The toolbar button moves inside the provider.
- **Deep link.** `page.tsx` reads `searchParams.zgloszenie`, passes it as an initial selection, and
  the provider strips the param after opening (`router.replace`), so a reload does not reopen it.
- **Pending count.** Server-read with the page, and updated from the accept / reject results.

### Success Criteria

#### Automated Verification:

- DOM spec `src/__tests__/components/nav/unread-badge.test.tsx`: the leads badge keeps its count on
  `/zgloszenia-prac`; the work-reports badge keeps its count on its own page.
- DOM spec `src/__tests__/components/kosztorys/editor/toolbar/worker-reports-button.test.tsx`: the
  button renders only while the count is > 0, and opens the shared dialog.

#### Manual Verification:

- With a report pending, the nav shows „Zgłoszenia prac” with the count. The page lists it, and the
  row opens the rozpiska with that report open. A reload after closing it does not reopen it.
- The leads „Zgłoszenia” badge still shows its count while on „Zgłoszenia prac”.
- After an accept, the toolbar button disappears once nothing is pending, and the nav count drops on
  the next navigation.

---

## Phase 5: Owed layout and editor seams

### Overview

The owner's owed layout items, plus shrinking the report's footprint in the shared editor.

### Changes Required

#### 1. Media-query hook

**File**: `src/hooks/use-media-query.ts` (new)

**Intent**: `useMediaQuery(query): boolean` via `useSyncExternalStore(matchMedia)`, with a
server snapshot of `false`. Sizes stay fixed constants; this hook only picks between two fixed
column sets.

#### 2. Lp gutter and j.m. at ≥768px

**File**: `editor/grid/report-column.tsx` (:60-78), `kosztorys-editor-body.tsx` (:552)

**Intent**: In „Ograniczona rozpiska” at ≥768px, keep the Lp gutter and add the `unit` column,
found by id as `description` is, since the owner's worker view settings may hide it. A phone keeps
Opis prac + „Zgłaszam”.

#### 3. Report branches as seams

**File**: `use-kosztorys-editor.ts` (:196, :600, :1240-1256), `kosztorys-editor-body.tsx`

**Intent**: Replace the hook's three `report` branches with neutral options the report page
supplies: `transformColumns`, `initialRowPatch`, `onPreviewChange`. Collapse the body's layout
branches into a `pageScroll` flag plus `header` / `footer` slots. Behaviour is unchanged. Keep
`report` as the one prop the page passes, and drop the SPIKE tags.

#### 4. Spike fixes: no alarms on documents

**File**: `kosztorys-v2-columns.tsx`, `grid/cells/subcontractor/cell-data.ts`, `subcontractor/price-cell.tsx`,
`subcontractor-columns.tsx`, `section-header-cell.tsx`, `src/__tests__/components/kosztorys/editor/grid/document-alarms.test.tsx`,
`remaining-overrun-tone.test.ts`

**Intent**: Already in the tree from the spike. On the investor's and the worker's document, cells
show no red: tones, the ceiling verdict and the plane-unconfirmed cell are the owner's alarms, and
those readers can act on none of them. Commit it with this phase; there is no new code.

#### 5. Dead column meta

**File**: `src/components/tables/column-meta.ts`, `tables/data-table/data-table-row.tsx:69`, `table-header.tsx:19`

**Intent**: Remove `desktopOnly`, left over from the dropped list variant. Gate the removal on
typecheck.

### Success Criteria

#### Automated Verification:

- DOM spec: `useMediaQuery` follows a stubbed `matchMedia` change.
- `document-alarms.test.tsx` and `remaining-overrun-tone.test.ts` pass.
- The existing editor specs under `src/__tests__/components/kosztorys/editor/` pass unchanged.

#### Manual Verification:

- „Ograniczona rozpiska” at 1280px shows Lp, Opis prac, j.m. and „Zgłaszam”; at 390px only Opis
  prac and „Zgłaszam”. „Wszystkie kolumny” still scrolls sideways with a sticky header and no
  blinking.
- The kierownik's editor, Podgląd and the investor / worker links look and behave as before.
- Podgląd and the worker link: no red cell anywhere, even on a row past its przedmiar or a stawka
  above the ceiling. The kierownik's editor still shows both in red.

---

## Phase 6: Living docs

### Changes Required

- **`context/foundation/lessons.md` ~253.** The report lines are the first outside referrer of an
  item id. Restore stays correct because the FK is `ON DELETE SET NULL`, the lines carry copied
  opis / j.m., and a lost line is re-pointed by hand (#14).
- **`AGENTS.md` phone scope.** Add the worker report page as the deliberate exception (#7).
- **`context/reference/kosztorys-editor-domain-notes.md` § Widok pracownika.** Record:
  - the two links;
  - how reports and acceptance work;
  - that acceptance adds;
  - the „Przyjęte” vs restore gap;
  - that accepted prace spoza rozpiski show as „wykonane bez przedmiaru” in „Problemy”.
- **`context/reference/outgoing-effects-isolation.md`.** No new outgoing effect. Add a line only if
  that doc lists public write surfaces.
- **Linear.** File the report-component extraction (see What We're NOT Doing).

### Success Criteria

#### Automated Verification:

- None.

#### Manual Verification:

- None.

---

## Testing Strategy

### Unit Tests

- `tokenAction`: one refusal per gate, the handler never reached.
- `save-lanes.drain`.
- `proxy` allowlist.
- `useMediaQuery`.

### Integration Tests (DB, 5435)

- The report layer: round-trip, CHECKs, the claim guard, `pendingQtyByItem`.
- `addStageProgress` additive semantics and the investment guard.
- Send: copied fields, refusals.
- Accept: additive, summed duplicates, new etap, extras, double-accept refusal, #16 refusal,
  pre-accept snapshot, rollback leaves everything unchanged.
- Restore keeps reports; user delete refused.

### DOM Tests

- Szkic prune.
- The acceptance hook's ordering and undo prune.
- The external-change reload.
- Badge boundaries.
- Toolbar button.

### Manual Testing Steps

Per phase above. Phone checks at 390px. Share links built on staging point at production
(`manual-verification.md:70`), so open the report link by replacing the host.

## Performance Considerations

- A report is a dozen lines, so reads are uncached and cheap.
- The partial index on pending reports keeps the nav count to an index-only scan.
- The FK indexes on `item_id` / `created_item_id` keep a 1000-item restore's `SET NULL` from
  scanning the lines table per item.

## Migration Notes

- Additive only. A human runs `pnpm db:migrate:prod` before the push.
- Local: `git status src/migrations` before migrating the shared dev and test DBs.
- No backfill.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- DB integration specs pass: `pnpm test:integration`
- Build succeeds: `pnpm build`

The full `pnpm test` runs only when the user asks.

## References

- Decisions and grounding: `context/changes/2026-09-30-worker-work-reports/change.md`
- Code map: `context/changes/2026-09-30-worker-work-reports/research.md`
- Raw-table precedent: `src/migrations/20260930_1_add_kosztorys_stage_workers.ts`
- Share collection precedent: `src/migrations/20260928_1_kosztorys_worker_view.ts`, `src/collections/kosztorys-worker-shares.ts`
- Transaction + snapshot precedent: `applyCatalogueToKosztorysAction` (`src/lib/actions/catalogue-to-kosztorys.ts:240-249`)
- Lessons: ~165 (mount-frozen rows), ~172 (save lanes), ~246 (cascade tags), ~253 (outside referrers), ~260 (snapshot on the tx), ~530 (tree insert columns), ~568 (public surfaces)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Storage

#### Automated

- [x] 1.1 Migration applies to dev and test DBs — 5b856f81
- [x] 1.2 `pnpm generate:types` succeeds — 5b856f81
- [x] 1.3 Report layer DB spec — 5b856f81
- [x] 1.4 `addStageProgress` DB spec — 5b856f81
- [x] 1.5 Restore keeps reports DB spec — 5b856f81
- [x] 1.6 User delete refused DB spec — 5b856f81

### Phase 2: The worker's side

#### Automated

- [x] 2.1 `tokenAction` refusal spec — a0e62334
- [x] 2.2 Send action DB spec — a0e62334
- [x] 2.3 Szkic prune DOM spec — a0e62334
- [x] 2.4 Proxy allowlist spec — a0e62334

### Phase 3: The kierownik's side

#### Automated

- [x] 3.1 Accept action DB spec — 99936d8e
- [x] 3.2 `drain` unit spec — 99936d8e
- [x] 3.3 Acceptance hook DOM spec — 99936d8e
- [x] 3.4 External-change reload DOM spec — 99936d8e

### Phase 4: Surfacing — nav, count, deep link

#### Automated

- [x] 4.1 Badge boundary DOM spec — e0244f47
- [x] 4.2 Toolbar button DOM spec — e0244f47

### Phase 5: Owed layout and editor seams

#### Automated

- [x] 5.1 `useMediaQuery` DOM spec
- [x] 5.2 Existing editor specs pass unchanged
- [x] 5.3 Document-alarms specs pass

### Phase 6: Living docs

#### Automated

- [ ] 6.1 Docs updated (lessons 253, AGENTS.md phone scope, domain notes)
