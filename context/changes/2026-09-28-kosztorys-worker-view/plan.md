# Widok pracownika (część 1, tylko odczyt) — Implementation Plan

## Overview

The owner gives a worker or subcontractor a **named** read-only view of an investment's kosztorys, as
a live link (`/p/[token]`) or a printed PDF. It answers two questions:

- what the worker has to do and what it pays at their stawka;
- how much they have done, how much has been paid and how much is still owed.

The view is scoped to the etapy assigned to that worker. Its prices are that etapy's rozliczenie
(`w_tools` / `own_tools`), never the client price.

One editor-side addition rides along (design #13): a **„Wartość przedmiaru netto — <rozliczenie>"**
column in the owner's crew-plane views, visible to OWNER **and** MANAGER. The worker view reuses the
same column as its „wartość przedmiaru po jego stawce".

Spec: `design.md` (decisions #1–#13). Linear: EX-875. Part 2 (the worker types quantities) is out of
scope.

## Current State Analysis

- **Worker assignment and rozliczenie already exist.**
  - `kosztorys-stages` carries `plane` (`w_tools`/`own_tools`, null = unconfirmed) and `worker`
    (→ users) (`src/collections/kosztorys-stages.ts:36-55`).
  - The tree read maps both into `KosztorysStageT {plane, workerId}`
    (`src/lib/db/kosztorys-tree.ts:80,156-161`, `src/lib/kosztorys/types.ts:100-106`).
- **Per-worker money already exists.**
  - `subcontractorDueByPlane(rows, stages).byWorker` / `.byStage` give executed value at each etap's
    plane, before rabat (`src/lib/kosztorys/subcontractor-due.ts:53-83`).
  - Payout rows come from `fetchPayoutTransactionsForInvestment(I)`
    (`src/lib/queries/investment-transactions.ts:19-30`) and are grouped by `derivePayoutsByWorker`
    (`src/lib/kosztorys/payouts-by-worker.ts:27-42`). That module's comment forbids a second
    `GROUP BY` query (`:20-22`).
  - `computeSubcontractorSummary` (`subcontractor-summary.ts:84-136`) is the precedent for rounding
    and the overpaid state.
- **The investor share is the template, and several parts are hard-wired to the client.**
  - Token collection: `src/collections/kosztorys-shares.ts`. Actions:
    `src/lib/actions/kosztorys-share.ts` (mint `randomBytes(24).base64url`, rotate, revoke = delete,
    and a find-then-create race rescue).
  - Public route `src/app/(share)/k/[token]/page.tsx`. Uncached token lookup
    `src/lib/queries/preview-kosztorys.ts:117-136`.
  - `preview` is the read-only render mode, and it also pins `view = 'client'`
    (`use-kosztorys-view-state.ts:66`). It narrows the summary panel through `allowedSummaryViews`
    and swaps the owner's row filters for `clientConditionIds`.
  - The closed column lists live in `column-selection.ts:41-58`: `assertDisclosurePair` and
    `closedColumnList`. The comment there says: "a future closed surface is one entry here".
- **There is no planned-value column at a crew rate.**
  - `plannedNet`, `remaining` and `donePercent` are pinned to `'client'` in every view, by owner
    ruling of 2026-09-23 (`column-config.ts:72-86`, `kosztorys-v2-columns.tsx:311-376`,
    `column-totals.ts:53-55`).
  - The formula exists: `rowPlannedNetForView(row, plane)` (`calc.ts:246`).
- **In a crew view, `price` is still the client price.** The stawka is the per-plane column
  `price__<plane>` (`planePriceKey`, `plane-price-keys.ts`). All per-plane rate columns assemble in
  every view; only an allowlist keeps them off a closed surface (`column-selection.ts:38-40`).
- **Crew-plane sums count every etap on the plane, not one worker's.**
  - `net` ("Suma etapy …"), `stageQtySum`, `columnTotalsForRows` and the section subtotals all
    iterate `stagesForView(stages, view)`.
  - Handing the grid **only the worker's etapy** as `stages` scopes every one of them for free,
    including `client-empty`, whose "executed" axis is `rowTotalQtyDone(row, ctx.stages, 'client')`
    (`registry.ts:17-23`).
- **The PDF is a client-side print window**, `offer-print-action.tsx` +
  `src/lib/kosztorys/offer-print/`.
  - Its shape is already generic: columns × `cell(row, view, stages)`, a row filter and totals.
  - The client-specific parts are module constants: `OFFER_COLUMNS`,
    `OFFER_PRICE_VIEW = 'client'`, the `PREVIEW_VISIBLE_COLUMNS` ceiling, and the literal header
    "Kosztorys ofertowy".
- **Migrations.**
  - Latest on disk is `20260928_0_investment_trashed_at.ts`.
  - Template for a collection with `created_at`/`updated_at` indexes:
    `20260903_0_add_equipment.ts`. Template for a global table: `20260815_0_add_kosztorys_client_view.ts`.
  - Compound unique precedent: `20260707_0_add_leads.ts:43`.
  - Checklist: `lessons.md` "A new Payload collection costs 9 things".

## Desired End State

- **Owner/manager editor.** In the „Z narzędziami" and „Bez narzędzi" views the column picker offers
  „Wartość przedmiaru netto — z narzędziami / bez narzędzi". It is priced at that plane's stawka and
  totalled in „Razem" and the section footers. It never appears in the client view.
  There is no brutto twin: crew views are netto-only (`effectiveMoneyAxis`, EX-558).
  The existing „Wartość przedmiaru netto" keeps reading at the client price.
- **Editor menu „Pracownicy"**, next to the investor menu:
  - It lists each worker assigned to at least one etap.
  - Each worker has: Podgląd, Link (generate / copy / revoke) and Drukuj PDF.
  - A worker whose etapy include a plane-less etap, or span both planes, has Link and PDF disabled,
    with the reason on screen.
  - „Ustawienia widoku pracownika" (column ticks + „ukryj puste pozycje"; saving is ADMIN/OWNER
    only) opens from the same menu.
- **`/p/[token]`** renders the worker view without a session:
  - Header: worker's full name + investment name.
  - Only the worker's etapy, priced at their stawka, with the columns from the firm-wide settings
    (capped by the worker allowlist).
  - One summary block: przedmiar value at their stawka; executed per etap + total; paid (sum + list
    of date/amount); owed or „Nadpłata".
  - An unknown or revoked token returns the same 404. A worker with no etapy sees „Brak przypisanych
    etapów". A worker whose etapy became plane-less or mixed after minting sees a notice, never
    prices.
- **The PDF** prints the same projection as the link, from the same builder.
- **No path serves a client price on a worker surface:** a separate token table, a separate closed
  list, and a plane-pin assert that throws.

### Key Discoveries:

- `closedColumnList` / `assertDisclosurePair` are the designed seam for a third closed surface
  (`src/components/kosztorys/editor/grid/column-selection.ts:41-58`).
- Narrowing `stages` to the worker's etapy server-side makes every existing sum and the `client-empty`
  rule worker-scoped with no new aggregate code (`column-totals.ts:40-70`, `registry.ts:17-23`).
- Two gaps remain after that narrowing:
  - „Pozostało" must subtract execution from **all** etapy (design #9), which the narrowed rows no
    longer carry.
  - Section subtotal and column-total code must learn the new przedmiar-at-plane id.
- The per-plane stawka column is namespaced (`price__w_tools`). Lesson: disclosure matches the full
  id, so the worker allowlist is **plane-resolved**: `price__<hisPlane>` only, never `price`.
- `KosztorysEditorBody` already renders a closed, slim-header, read-only surface for `preview`
  (`kosztorys-editor-body.tsx:409-451`). Lesson: a price-view flag is not an audience flag.
  `preview` keeps meaning "read-only share render", and the worker gets its own audience input.
  Reusing `previewVisible` would trip `assertDisclosurePair`.
- `fetchPayoutTransactionsForInvestment` is cached on `transfers`. The worker payload must derive
  "paid" from the same rows, not from a new query (`payouts-by-worker.ts:20-22`).

## What We're NOT Doing

- Part 2: the worker entering quantities, write auth, conflict handling.
- A per-investment override of the worker view settings (design #5).
- An Oferta/Rozliczenie mode split for the worker (design #4).
- „Pozostało po stawce" as an owner-editor column. It is assembled on the worker surface only. The
  owner's „Pozostało netto" stays client-priced per the 2026-09-23 ruling. Add it on request.
- A payout's description on any worker surface (design #10).
- Payouts not booked on this investment (design, Podsumowanie note).
- A server-side PDF generator.
- E2E specs. They are filed to the Linear `e2e-backlog` at the review gate.

## Implementation Approach

1. **Build bottom-up.** Pure logic first (TDD), then data, then the server projection, then the grid
   surface, then the editor entry points, then print.
2. **Scope by data, not by render flags.** The server builds the worker payload from the tree with
   `stages` narrowed to the worker's etapy and rows carrying only those etapy's quantity keys. Two
   extras ride with each row:
   - the per-row all-etapy executed quantity, for „Pozostało";
   - nothing else from other workers.

   Every downstream sum is then correct by construction, and the grid needs only a closed list plus
   a plane pin.

3. **One projection, three consumers.** The token page, the owner's Podgląd and the PDF all go
   through one builder, so the three cannot drift.

## Critical Implementation Details

- **Disclosure pin.** The worker surface pins `view` to the worker's plane. A new assert throws when:
  - `workerVisible` is set and `view` is `'client'` or ≠ the worker plane; or
  - `workerVisible` and `previewVisible` are both set.

  The worker closed list is built per plane. The client `price`, the other plane's
  `price__`/`priceMode__`/`priceCoeff__`, every discount column, `plannedNet`/`plannedGross`,
  `remaining`/`remainingGross`, `donePercent`, gross columns and `note` are absent **by
  construction**. A unit test enumerates them.

- **Blocked scope** is one pure function, used by the menu (to disable), the mint action (to refuse
  server-side) and the page (to show a notice instead of prices). It covers:
  - no etapy;
  - any assigned etap with `plane = null`;
  - etapy on two planes.
- **Migration ordering.** The migration is additive, so prod runs `pnpm db:migrate:prod` (by a
  human) **before** the push that ships it.

## Phase 1: „Wartość przedmiaru — <rozliczenie>" column in the editor

### Overview

A standalone editor feature (design #13) that ships value on its own. The worker view later reuses it
as its planned-value column.

### Changes Required:

#### 1. Column config

**File**: `src/lib/kosztorys/column-config.ts`

**Intent**: Register the new id, its label and axis, and hide it in the client view, where it would
duplicate „Wartość przedmiaru netto". Netto only: crew views pin the axis to netto
(`effectiveMoneyAxis`, `money-axis.ts:27`), since subcontractors are paid without VAT (EX-558).

**Contract**:

- New id `plannedNetForPlane`.
- `COLUMN_LABELS` entries. `columnLabelForView` appends `planeDashSuffix(view)`, giving „Wartość
  przedmiaru netto — z narzędziami".
- `COLUMN_MONEY_AXIS` `'net'`.
- Layer `work` (untagged).
- A new exported set `CREW_PLANE_ONLY_COLUMNS` holds the id. It is the mirror of
  `PRZEDMIAR_ANCHORED_COLUMNS`: a column readable only when `view !== 'client'`.
- It is not added to `CLIENT_VIEW_GROUPS`.

#### 2. Assembly and selection

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`,
`src/components/kosztorys/editor/grid/column-selection.ts`

**Intent**: Assemble the column next to `plannedNet`, computed at `view`. Drop it in
the client view at the same chokepoints that handle `PRZEDMIAR_ANCHORED_COLUMNS`.

**Contract**:

- Cell: `rowPlannedNetForView(r, view)`.
- `selectV2Columns` and `selectV2ToggleItems` skip `CREW_PLANE_ONLY_COLUMNS` when
  `view === 'client'`.
- The default visibility follows the picker like any other column. It is not in
  `DEFAULT_HIDDEN_COLUMNS`.

#### 3. Totals

**File**: `src/lib/kosztorys/column-totals.ts` (and the section-subtotal path if it keys by column id)

**Intent**: „Razem" and the section footers total the new column.

**Contract**: When `view !== 'client'`, `columnTotalsForRows` sets
`plannedNetForPlane = Σ rowPlannedNetForView(row, view)`.

#### 4. Tests

**File**: `src/__tests__/components/kosztorys/editor/grid/planned-net-for-plane-columns.test.ts`,
`src/__tests__/lib/kosztorys/column-totals.test.ts` (extend if present, else new)

**Intent**: Pin that the column exists and is priced at the view's stawka in both crew views, is
absent from the client view and its picker, and that its total equals Σ cells.

### Success Criteria:

#### Automated Verification:

- New column spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/planned-net-for-plane-columns.test.ts`
- Totals spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/column-totals.test.ts`
- Existing closed-surface specs still pass: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts src/__tests__/components/kosztorys/editor/grid/workshop-columns.test.ts`

#### Manual Verification:

- As OWNER and as MANAGER, in the „Z narzędziami" view, tick „Wartość przedmiaru netto — z
  narzędziami". It shows przedmiar × stawka z narzędziami, and „Razem" equals the sum.
- Switching to the Inwestor view removes the column and its picker entry.

---

## Phase 2: Worker view logic (pure, React-free)

### Overview

Everything the worker surfaces decide, as testable functions in `src/lib/kosztorys/`: scope and block
reasons, the summary block, the settings allowlist and sanitizer, and the plane-resolved closed
column list.

### Changes Required:

#### 1. Worker scope

**File**: `src/lib/kosztorys/worker-view/scope.ts`

**Intent**: One decision about which etapy belong to the worker and whether a priced view may be
shown. The menu, the mint action and the page all share it.

**Contract**:
`resolveWorkerScope(stages, workerId)` returns one of:

- `{ kind: 'ready', plane: ToolPlaneT, stages: KosztorysStageT[] }`;
- `{ kind: 'blocked', reason: 'no-stages' | 'unconfirmed-plane' | 'mixed-planes' }`.

UI copy lives in `constants.ts`: „Brak przypisanych etapów", „Ustaw rozliczenie etapu", „Etapy
pracownika mają różne rozliczenia".

#### 2. Worker summary

**File**: `src/lib/kosztorys/worker-view/summary.ts`

**Intent**: Compute the four-part summary block (design Podsumowanie), with rounding following
`computeSubcontractorSummary`.

**Contract**:
`computeWorkerSummary({ rows, stages: hisStages, plane, workerId, payoutRows })` returns
`{ plannedNet, executedByStage: {stageId, label, net}[], executedNet, payouts: {date, amount}[], paidNet, owed, isOverpaid }`.

- `executedNet` must equal `subcontractorDueByPlane(rows, hisStages).byWorker.get(workerId)`.
  Reuse it; do not re-derive.
- `paidNet` comes from `payoutRows` filtered to the worker, then `roundToCents`.
- `owed` is `roundToCents(executed − paid)`. A negative value sets `isOverpaid` and the magnitude is
  shown as „Nadpłata".
- `payouts` never carries `description`.

#### 3. Settings allowlist and sanitizer

**File**: `src/lib/kosztorys/column-config.ts` (groups), `src/lib/kosztorys/worker-view/settings.ts`

**Intent**: A firm-wide, fail-closed worker settings shape. The groups are the ceiling; the settings
only subtract from them.

**Contract**:

- `WORKER_VIEW_GROUPS` uses logical keys:
  - `sectionName`, `description`, `plannedQty`, `unit`;
  - `rate` (resolves to `price__<plane>`);
  - `plannedNetForPlane`;
  - `STAGES_COLUMN_GROUP`, `stageQtySum`, `STAGE_VALUE_NET_COLUMN_GROUP`, `net`;
  - `remainingForPlane`.
- `WorkerViewSettingsT = { hiddenColumns: string[]; hideEmptyRows: boolean }`.
- `sanitizeWorkerViewSettings(raw)` drops unknown keys. Missing or invalid input returns the code
  default (all visible, `hideEmptyRows: true`).
- `workerVisibleColumns(plane, hidden)` returns the **full-id** closed list. Every other plane's ids
  and every client-price id are unreachable.

#### 4. Tests

**File**: `src/__tests__/lib/kosztorys/worker-view/scope.test.ts`, `summary.test.ts`, `settings.test.ts`

**Intent**: Test-first, anchored on the design's main risk.

- **scope:** each block reason; a worker on two etapy of the same plane is ready.
- **summary:**
  - executed equals `byWorker`;
  - another worker's etap and a null-worker payout are excluded;
  - an overpaid case;
  - a fully paid case reads 0, not -0.
- **settings:**
  - a hand-added `price`, `plannedNet`, `discountAmount` or other-plane key is dropped;
  - garbage input returns the default;
  - the closed list for `w_tools` contains `price__w_tools` and no `price` / `price__own_tools`.

### Success Criteria:

#### Automated Verification:

- Worker-view unit specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/worker-view`

#### Manual Verification:

- None (pure logic).

---

## Phase 3: Data — worker share links + worker view settings

### Overview

The persistent layer: the link table and the firm-wide settings global.

### Changes Required:

#### 1. Collection

**File**: `src/collections/kosztorys-worker-shares.ts`

**Intent**: One token per (investment, worker), kept separate from `kosztorys-shares` so no branch
decides which view a token opens (design, Dane).

**Contract**:

- Slug `kosztorys-worker-shares`.
- Fields: `investment` (rel, required), `worker` (rel users, required), `token` (text, unique,
  readOnly).
- Access `isAdminOrOwnerOrManager`. No hooks, since the lookup is uncached.
- The pair uniqueness lives in the migration: Payload `unique` is single-column.

#### 2. Global

**File**: `src/globals/kosztorys-worker-view-settings.ts`

**Intent**: Firm-wide worker view settings (design #5).

**Contract**:

- Slug `kosztorys-worker-view-settings`.
- Fields `hiddenColumns` (json) and `hideEmptyRows` (checkbox).
- Read `isAdminOrOwnerOrManager`, update `isAdminOrOwner`.

#### 3. Registration + migration

**File**: `src/payload.config.ts`, `src/migrations/20260928_1_kosztorys_worker_view.ts`,
`src/migrations/index.ts`

**Intent**: A hand-written, additive migration following the 9-item checklist.

**Contract**:

- The header comment "Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md)".
- `kosztorys_worker_shares`:
  - `id serial`;
  - `investment_id` FK `ON DELETE CASCADE`;
  - `worker_id` FK users `ON DELETE CASCADE` (a link without its worker is worthless);
  - `token varchar NOT NULL`;
  - `updated_at`/`created_at` plus indexes (template `20260903_0_add_equipment.ts`).
- Unique index on `token`. Unique index `kosztorys_worker_shares_investment_worker_idx` on
  `(investment_id, worker_id)`.
- `payload_locked_documents_rels.kosztorys_worker_shares_id`, with its FK and index.
- Global table `kosztorys_worker_view_settings` (template `20260815_0`).
- `down()` in exact reverse order. Register the migration in `index.ts`.
- If another agent landed a later `20260928_*` in the meantime, bump the suffix so the filename sort
  stays correct.

### Success Criteria:

#### Automated Verification:

- Migration applies to local docker DB: `pnpm payload migrate`
- Types regenerate with the new slugs: `pnpm generate:types`
- Pair uniqueness enforced (DB spec): `pnpm exec vitest run src/__tests__/lib/actions/worker-share-token.test.ts` (authored in Phase 4, the unique-pair case lands here)

#### Manual Verification:

- None.

---

## Phase 4: Server — link actions, settings actions, projection, routes

### Overview

Minting and revoking links, reading and saving settings, the one worker payload builder, and the two
routes that render it.

### Changes Required:

#### 1. Link actions

**File**: `src/lib/actions/kosztorys-worker-share.ts`

**Intent**: A mirror of `kosztorys-share.ts`, keyed by (investment, worker).

**Contract**:

- `getWorkerShareLinkAction`, `generateWorkerShareLinkAction` (rotates if present) and
  `revokeWorkerShareLinkAction`, each taking `{ investmentId, workerId }`.
- All go through `protectedAction` (MANAGEMENT_ROLES).
- Generate refuses when `resolveWorkerScope` is blocked for `unconfirmed-plane` / `mixed-planes`.
  `no-stages` is also refused at mint, since the menu never lists such a worker.
- Keep the find-then-create race rescue.

#### 2. Settings read and save

**File**: `src/lib/queries/kosztorys-worker-view.ts`, `src/lib/actions/kosztorys-worker-view.ts`

**Intent**: An uncached read with sanitize on the way out, and a save.

**Contract**:

- `getWorkerViewSettings()` returns the sanitized `WorkerViewSettingsT`, falling back to the code
  default.
- `saveWorkerViewSettingsAction(settings)` is gated to ADMIN/OWNER and sanitizes before write.
- A `'use server'` read wrapper for the dialog, the same shape as `client-view-settings-endpoint.ts`.

#### 3. Worker payload builder

**File**: `src/lib/queries/worker-kosztorys.ts`

**Intent**: The single projection that the link, Podgląd and PDF all consume (design, Widok).

**Contract**:

- `buildWorkerKosztorysData(investmentId, workerId)` does the following:
  1. Takes the tree (`buildKosztorysTree`), runs `resolveWorkerScope`, and resolves the worker name.
  2. **If ready**, returns:
     - `stages` = the worker's etapy;
     - rows via `treeToRows` over the narrowed stages, plus a per-row all-etapy executed qty;
     - section structure;
     - `plane`;
     - `summary = computeWorkerSummary(...)` with payout rows from
       `fetchPayoutTransactionsForInvestment`;
     - investment name and vat.
  3. **If blocked**, returns the reason only, with no rows and no prices.
- Cached with `unstable_cache`: key `'worker-kosztorys-data-v1'`, args `[investmentId, workerId]`,
  tags `kosztorysSections`, `kosztorysItems`, `kosztorysStages`, `stageProgress`, `investments`,
  `transfers`, `users`.
- Settings are attached uncached, like `withClientView`.
- `getWorkerKosztorysByToken(token)` does an uncached lookup with `overrideAccess: true`; an unknown
  or empty token returns null.
- `getWorkerKosztorysPreview(investmentId, workerId)` requires MANAGEMENT_ROLES.
- `getWorkerKosztorysPrintData(investmentId, workerId)` is the `'use server'` read the PDF action
  calls. It uses the same builder and the same gate.

#### 4. Routes

**File**: `src/app/(share)/p/[token]/page.tsx`,
`src/app/(share)/podglad-pracownika/[id]/[workerId]/page.tsx`

**Intent**: The public link and the owner's Podgląd, both rendering one worker surface component
(Phase 5).

**Contract**:

- Both routes reuse the `(share)` layout (noindex, no session).
- A null lookup calls `notFound()`.
- A blocked result renders a plain notice.
- Podgląd guards with `requireInvestmentOr404`.

#### 5. Tests (DB, `describe.skipIf(!ENV_READY)` — confirm a non-zero test count)

**File**: `src/__tests__/lib/actions/worker-share-token.test.ts`,
`src/__tests__/lib/queries/worker-kosztorys-token.test.ts`,
`src/__tests__/lib/queries/worker-kosztorys-read.test.ts`

**Intent**: Cover the security seams listed in design Testy.

- **worker-share-token.test.ts:**
  - generate, rotate and revoke;
  - MANAGER can generate, rotate and revoke (same as OWNER); EMPLOYEE is refused with no write;
  - the pair is unique;
  - a mint for a mixed-plane or plane-less worker is refused.
- **worker-kosztorys-token.test.ts:**
  - an unknown or revoked token returns null;
  - a worker token never resolves through `getPreviewKosztorysByToken`, and an investor token never
    resolves through `getWorkerKosztorysByToken`;
  - the payload carries only the worker's etapy.
- **worker-kosztorys-read.test.ts:** the preview read rejects unauthenticated and sub-management
  sessions.

### Success Criteria:

#### Automated Verification:

- Worker share action spec passes: `pnpm exec vitest run src/__tests__/lib/actions/worker-share-token.test.ts`
- Worker token/read specs pass: `pnpm exec vitest run src/__tests__/lib/queries/worker-kosztorys-token.test.ts src/__tests__/lib/queries/worker-kosztorys-read.test.ts`

#### Manual Verification:

- None beyond Phase 5.

---

## Phase 5: Worker surface in the grid and page

### Overview

The render: closed columns, the plane pin, the worker header, the summary block and the empty-rows
switch.

### Changes Required:

#### 1. Third closed surface

**File**: `src/components/kosztorys/editor/grid/column-selection.ts`,
`src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts`

**Intent**: Add `workerVisible` (plus `workerPlane` and the plane-resolved list) as the third entry of
`closedColumnList`, and extend the disclosure assert (Critical Implementation Details).

**Contract**:

- `closedColumnList` returns `workerVisibleColumns(opts.workerPlane, hidden)` for `workerVisible`.
- `assertDisclosurePair` throws for `workerVisible && view !== workerPlane`, for
  `workerVisible && view === 'client'`, and for `workerVisible && previewVisible`.
- Per-plane `priceMode`/`priceCoeff` are refused at assembly on the worker surface too, mirroring
  `withMode`.

#### 2. „Pozostało" at the stawka (worker surface only)

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`,
`src/lib/kosztorys/column-totals.ts`, `src/lib/kosztorys/column-config.ts`

**Intent**: Design #9: przedmiar value at the worker's stawka minus the value of execution in **all**
etapy, at the same stawka.

**Contract**:

- Id `remainingForPlane`, label „Pozostało netto (względem przedmiaru)".
- Assembled only when `workerVisible`.
- It reads the per-row all-etapy executed quantity that the payload supplies, because the narrowed
  `stages` no longer carries it.
- `columnTotalsForRows` totals it when given that per-row quantity.

#### 3. Audience wiring

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`,
`use-kosztorys-editor.ts`, `hooks/use-kosztorys-view-state.ts`

**Intent**: A worker audience input, kept distinct from `preview`. `preview` keeps its read-only
machinery; the worker input pins `view` to the worker's plane instead of `'client'`, sets
`workerVisible` instead of `previewVisible`, and takes its hidden set and empty-row rule from the
worker settings.

**Contract**:

- A new optional prop `worker?: { workerId, name, plane, summary, settings }`.
- The view pin becomes `preview ? (worker?.plane ?? 'client') : …`.
- Empty rows reuse `client-empty`. Because `stages` are the worker's etapy, the executed axis is
  already their etapy (design: puste pozycje).
- The slim header shows the worker's name next to the investment name.

#### 4. Summary block

**File**: `src/components/kosztorys/summary/blocks/worker-summary.tsx`

**Intent**: One block, no tab switch, rendered from `summary` in the design's order. The owner's
summary panel does not mount on the worker surface.

**Contract**: Labels:

- „Wartość przedmiaru (Twoja stawka)";
- per-etap lines + „Wykonane razem";
- „Wypłacone" + list (data, kwota);
- „Pozostało do wypłaty" / „Nadpłata".

#### 5. Page component

**File**: `src/components/kosztorys/worker-view/worker-kosztorys-page.tsx`

**Intent**: Shared by `/p/[token]` and Podgląd. It maps the builder result to a body render or a
blocked notice.

#### 6. Tests

**File**: `src/__tests__/components/kosztorys/editor/grid/worker-columns.test.ts`,
`src/__tests__/components/kosztorys/editor/hooks/use-kosztorys-view-state.test.tsx` (extend),
`src/__tests__/components/kosztorys/summary/blocks/worker-summary.test.tsx`

- **worker-columns:**
  - the closed list ignores stored preferences;
  - `price` / other-plane rate / `plannedNet` / discounts / gross are unreachable even when a
    hand-crafted hidden set or allowlist edit tries;
  - the assert throws on a wrong `view` and on `previewVisible` + `workerVisible`;
  - there is no picker.
- **use-kosztorys-view-state:** the worker pins its plane against a stored client or other-plane
  view.
- **worker-summary:** renders „Nadpłata" for overpaid, the payout list without descriptions, and
  0,00 when fully paid.

### Success Criteria:

#### Automated Verification:

- Worker column spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/worker-columns.test.ts`
- View-state spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/hooks/use-kosztorys-view-state.test.tsx`
- Summary block spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/summary/blocks/worker-summary.test.tsx`
- Existing preview specs unchanged: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`

#### Manual Verification:

- Open `/p/<token>` in a private window:
  - the worker's name is in the header;
  - only their etapy show;
  - „Cena j.m." equals their stawka, and no client price is visible anywhere;
  - summary figures match „Podsumowanie pracowników" in the editor for that worker.
- „Ukryj puste pozycje": a row executed only by another worker disappears, and the totals don't move.
- A second worker on the same plane: neither sees the other's quantities or values.

---

## Phase 6: Editor — menu „Pracownicy" + settings dialog

### Overview

The owner-side entry points: the worker menu, the link dialog and the settings dialog.

### Changes Required:

#### 1. Menu and actions state

**File**: `src/components/kosztorys/editor/actions/worker-actions.tsx`,
`src/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.tsx`,
`kosztorys-actions-context.tsx`, `kosztorys-actions-menu.tsx`

**Intent**:

- Add a „Pracownicy" menu beside the investor menu.
- Workers are the unique non-null `stage.workerId`s, resolved against the `workers` roster (inactive
  workers included, design #12).
- Per worker: Podgląd (`/podglad-pracownika/{id}/{workerId}`, new tab), Link, Drukuj PDF.
- A blocked worker shows the reason and has Link and PDF disabled.
- The state lives in `KosztorysActionsProvider` under a `worker` key, not in the editor context
  (EX-496).

**Contract**:

- Hidden on the szablon workbench, like the investor menu.
- Blocked state comes from `resolveWorkerScope`.

#### 2. Link dialog

**File**: `src/components/kosztorys/editor/dialogs/kosztorys-worker-share-dialog.tsx`

**Intent**: The link step of `kosztorys-share-dialog.tsx` for one worker: generate / rotate, copy,
revoke with confirm. The URL is `${FRONTEND_URL}/p/${token}`, and the title names the worker.

#### 3. Settings dialog

**File**: `src/components/kosztorys/editor/dialogs/kosztorys-worker-view-dialog.tsx`,
`client-view-settings-form.tsx`

**Intent**: Parametrize `ClientViewSettingsForm` so the worker dialog reuses it: groups, an optional
mode toggle, and the empty-row count as props. The worker dialog passes `WORKER_VIEW_GROUPS` with no
mode toggle and one „Zapisz". For a non-owner it opens read-only.

#### 4. Tests

**File**: `src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.test.tsx`,
`kosztorys-actions-menu.test.tsx` (extend)

- **kosztorys-workers-menu:**
  - lists only assigned workers, each once;
  - a blocked worker has Link/PDF disabled with the reason;
  - MANAGER gets Podgląd, Link and Drukuj PDF enabled; only the settings save is disabled for them.
- **kosztorys-actions-menu:** the menu is hidden in the workbench.

### Success Criteria:

#### Automated Verification:

- Workers menu spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.test.tsx`
- Actions menu spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.test.tsx`
- Investor settings form still passes its specs after parametrization: `pnpm exec vitest run src/__tests__/lib/kosztorys/client-view-groups.test.ts`

#### Manual Verification:

- Generate a link, copy it and open it anonymously. Revoke it: the link returns 404 on the next load.
- Set an etap's rozliczenie to „nie potwierdzone" (a legacy row) or assign one worker to both planes:
  Link/PDF are disabled with the right message.
- As MANAGER, the settings dialog is read-only. As OWNER, unticking a column hides it on every
  worker link.

---

## Phase 7: PDF + docs

### Overview

The worker print, built on a parametrized offer-print module, and the documentation updates.

### Changes Required:

#### 1. Parametrize offer-print

**File**: `src/lib/kosztorys/offer-print/build-offer-print-html.ts`, `columns.ts`

**Intent**: Turn the module constants into arguments, and keep the offer print byte-identical.

**Contract**: `OfferPrintArgsT` gains:

- `columns`, `priceView`, `ceiling`;
- `title` / `subtitle`;
- `rowFilter`;
- a money key for section totals;
- an optional `footerHtml`.

`buildOfferPrintHtml` for the investor passes today's constants.

#### 2. Worker print

**File**: `src/lib/kosztorys/offer-print/worker-columns.ts`,
`src/components/kosztorys/editor/actions/worker-print-action.tsx`

**Intent**:

- Worker columns: description, Przedmiar, j.m., stawka, przedmiar value at stawka, per-etap qty and
  value for the worker's etapy, Pozostało. They are capped by `workerVisibleColumns(plane, hidden)`.
- The footer is the summary block.
- The action opens the popup synchronously, then awaits `getWorkerKosztorysPrintData`. It then
  writes and prints (the same popup/logo/`printThenClose` flow as `offer-print-action.tsx`).
- The header is „Kosztorys — <imię i nazwisko>" + investment.

#### 3. Tests

**File**: `src/__tests__/lib/kosztorys/offer-print/build-offer-print-html.test.ts` (extend),
`src/__tests__/lib/kosztorys/offer-print/worker-print.test.ts`

- **build-offer-print-html:** the investor output is unchanged (existing assertions stay green).
- **worker-print:**
  - no client price or other-plane rate in the HTML;
  - totals equal the summary's `plannedNet` / `executedNet`;
  - empty rows are hidden without moving the totals;
  - „Nadpłata" renders.

#### 4. Docs

**File**: `context/reference/kosztorys-editor-domain-notes.md` (worker view section),
`context/foundation/lessons.md` (only if a new durable lesson emerged)

**Intent**: Record the worker surface rules: scope by etap assignment, plane pin, „Pozostało" over
all etapy, the payout list without description, and the „Wartość przedmiaru — <rozliczenie>" column.
Archive `design.md`'s rationale into the living doc at close.

### Success Criteria:

#### Automated Verification:

- Offer print spec still passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/offer-print/build-offer-print-html.test.ts`
- Worker print spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/offer-print/worker-print.test.ts`

#### Manual Verification:

- „Drukuj PDF" for a worker: the header names them; the columns match their link; the footer shows
  przedmiar at stawka / wykonane per etap / wypłacone with list / pozostało; there is no client price.
- The investor „Generuj ofertę" PDF looks exactly as before.

---

## Testing Strategy

### Unit Tests:

- Worker scope, summary, settings and closed list (Phase 2). These are the main-risk guards.
- The crew-plane przedmiar column and its totals (Phase 1).
- Print HTML for the worker, and investor print unchanged (Phase 7).

### Integration Tests:

- DB specs:
  - token lifecycle, pair uniqueness, and cross-token isolation (investor ↔ worker);
  - role gates;
  - the payload carries only the worker's etapy (Phase 4).
- They run under `pnpm test:integration`.

### Manual Testing Steps:

1. Assign worker A to etap 1 (z narzędziami) and worker B to etap 2 (z narzędziami). Enter
   quantities in both and book a PAYOUT to A.
2. Open A's link anonymously:
   - only etap 1 shows;
   - „Suma etapy" and „Wykonane" equal A's line in „Podsumowanie pracowników";
   - the wypłata is listed without its description;
   - „Pozostało" on a row finished by B reads 0.
3. Print A's PDF and compare it to the link.
4. Revoke A's link: it returns 404. B's link still works.

## Performance Considerations

The worker payload is cached per (investment, worker) on the tree, transfers and users tags. The
token lookup stays uncached so a revocation takes effect on the next request. The narrowed `stages`
means the grid computes over fewer columns than the owner view.

## Migration Notes

The migration is additive (new table + global table). Order: **`pnpm db:migrate:prod` by a human
before the push** that ships Phase 3+. A restore of a kosztorys doesn't touch links: links key on
(investment, user) and never store stage ids. A restore can change what a worker's link shows, since
assignments come back with the snapshot. That is accepted.

## Whole-tree Gate

Run once, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit + DOM suite passes: `pnpm test`
- DB integration suite passes: `pnpm test:integration`
- Build succeeds: `pnpm build`

## References

- Spec: `context/changes/2026-09-28-kosztorys-worker-view/design.md`
- Investor share precedent: `context/archive/2026-07-20-kosztorys-client-share/`
- Worker assignment decisions: `context/archive/2026-07-27-kosztorys-stage-worker-assignment/change.md`
- Crew-view settlement: `context/archive/2026-07-25-subcontractor-view-settlement-only/`
- Closed surfaces: `src/components/kosztorys/editor/grid/column-selection.ts:30-58`
- Per-worker money: `src/lib/kosztorys/subcontractor-due.ts:53-83`, `src/lib/kosztorys/subcontractor-summary.ts:84-136`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: „Wartość przedmiaru — <rozliczenie>" column in the editor

#### Automated

- [x] 1.1 New column spec passes — 10df15a4
- [x] 1.2 Totals spec passes — 10df15a4
- [x] 1.3 Existing closed-surface specs still pass — 10df15a4

### Phase 2: Worker view logic (pure, React-free)

#### Automated

- [x] 2.1 Worker-view unit specs pass

### Phase 3: Data — worker share links + worker view settings

#### Automated

- [ ] 3.1 Migration applies to local docker DB
- [ ] 3.2 Types regenerate with the new slugs
- [ ] 3.3 Pair uniqueness enforced (DB spec)

### Phase 4: Server — link actions, settings actions, projection, routes

#### Automated

- [ ] 4.1 Worker share action spec passes
- [ ] 4.2 Worker token/read specs pass

### Phase 5: Worker surface in the grid and page

#### Automated

- [ ] 5.1 Worker column spec passes
- [ ] 5.2 View-state spec passes
- [ ] 5.3 Summary block spec passes
- [ ] 5.4 Existing preview specs unchanged

### Phase 6: Editor — menu „Pracownicy" + settings dialog

#### Automated

- [ ] 6.1 Workers menu spec passes
- [ ] 6.2 Actions menu spec passes
- [ ] 6.3 Investor settings form still passes its specs after parametrization

### Phase 7: PDF + docs

#### Automated

- [ ] 7.1 Offer print spec still passes
- [ ] 7.2 Worker print spec passes
