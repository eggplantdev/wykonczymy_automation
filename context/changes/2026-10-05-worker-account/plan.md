# Worker account (EX-985) Implementation Plan

## Overview

An `EMPLOYEE` logs in and lands on **his own** `/pracownicy/<id>`, read-only. The page shows his kasy
with saldo, his sprzęt, and every transfer that touches him: his wypłaty/premie **and** everything
that went through his kasy. It also lists the kosztorysy he is assigned to, each with its `/z/` report
link. The link is minted automatically whenever a worker is assigned to an etap, and backfilled once
for existing pairs. The worker's kasa view (`/kasa/[id]` for EMPLOYEE) goes away.

All owner decisions are recorded in `change.md` and `research.md` → „Decisions on open questions". This
plan only sequences them.

## Current State Analysis

- `(dashboard)/page.tsx:15-25` sends an EMPLOYEE to his `WORKER` kasa, or to a 404 if he has none (28/49
  workers). `/pracownicy/[id]` lets only `ADMIN_OR_OWNER_MANAGER_ROLES` in (`page.tsx:23`).
- Transfers on the worker page are `{ ...urlFilters, worker: { equals: id } }`, which is payouts and
  bonuses only (`page.tsx:33-34`).
- The same `Where` feeds two planes: the Payload list (`overrideAccess: true`) and the sum tile through
  `where-to-sql`. That translator handles `or` but throws on `and` (`where-to-sql.ts:57-71`).
- `fetchEquipmentAtLocation` throws for non-management (`equipment.ts:97-98`), so the page would land
  on `error.tsx`.
- Faktury/Drukuj call `fetchFilteredTransfers(where)` with a client-supplied `Where` behind a
  management gate (`fetch-transfers-for-invoices.ts:22-29`).
- The page shows `EditWorkerDialog`, links to `/kasa/[id]` and `/sprzet/[id]`, a „Wróć" crumb that
  falls back to `/pracownicy`, an actions column with an ungated „Anuluj", and an invoice cell with
  „+"/delete. Every one of these refuses or bounces an EMPLOYEE.
- Report links are minted only on a manager's click (`kosztorys-worker-share.ts`) and refused while
  the scope is blocked (`:27`). Every write to `kosztorys_stage_workers` goes through
  `insertStageMembers` (`stage-split.ts:35-49`), always inside a transaction.

## Desired End State

- An EMPLOYEE who opens `/` lands on `/pracownicy/<his id>`. Any other worker's id, and any
  `/kasa/[id]`, gives 404. He sees no edit, cancel or upload control, and no link into a manager page
  except investment links, which bounce back to his page (owner decision 3).
- Both a manager and the worker see the same transfer list on that page: `worker = id OR source/target
kasa ∈ his kasy`, URL filters can only narrow it, and the sum tile agrees with the list.
  Faktury/Drukuj work for the worker and only ever cover that scope.
- Assigning a worker to an etap by any route (dodaj etap, zmiana składu, akceptacja zgłoszenia, import,
  przywrócenie wersji) leaves exactly one `worker_report_shares` row for that inwestycja × pracownik.
  After the migration, every existing pair has one.
- The page lists his inwestycje in status `active` / `planowana` / `quote` (not trashed), each with a
  working `/z/` link. The page works at 390px.
- In the manager's „Link do zgłoszeń" the only option is rotation („Wygeneruj nowy"). „Wyłącz link"
  is gone, and a blocked scope shows its reason next to the link instead of hiding the link.

### Key Discoveries:

- `buildTransferFilters` never emits `and`, and four readers look only at top-level keys
  (`stripCancelledFilters`, `listsCancelled`, `resolveAmountSearch`, `isNoResultsSentinel`). That
  makes `{ ...urlFilters, and: [scope] }` the only safe composition (`research.md` §3).
- `in: []` renders `IN ()`, which is a Postgres syntax error. A worker without kasy gets a scope with
  no kasa branches.
- `writeShareToken` races by catch-and-re-read and cannot run inside a transaction. The mint inside
  `insertStageMembers` must be a plain `INSERT … ON CONFLICT (investment_id, worker_id) DO NOTHING`.
- `ShareLinkPanel` is shared with the investor dialog, so `revoke` becomes optional rather than being
  removed (`share-link-panel.tsx:14-26`).
- `pgcrypto` is absent. Backfill tokens come from `gen_random_uuid()`. Token format is never
  validated, so the different format still resolves.

## What We're NOT Doing

- Worker expenses / drafts (EX-971, `2026-10-05-worker-expenses`). `canMutateTransfer`'s
  `createdBy === self` stays as is: it is dead for EMPLOYEE until EX-971.
- Login by username, and manager-set passwords. The worker sets his own password through „Zapomniane
  hasło"; no new code.
- A server-side template guard on `addStageAction` (UI-only today; out of scope per research).
- Narrowing the investment filter (owner decision 3: a foreign inwestycja simply yields 0 rows).
- Mobile card layout for tables. The horizontal-scroll table is accepted.
- `view-as` (`2026-10-05-view-as`). This plan reads the session only through `requireAuth` /
  `getCurrentUserJwt`, which is where view-as will plug in. No extra work here.

## Implementation Approach

Build bottom-up so each layer is testable before the page uses it:

1. Teach `where-to-sql` `and`, then build one scope function that both the page and the
   Faktury/Drukuj action call. Lesson `lessons.md:569`: never accept a client `Where`.
2. Open the page to EMPLOYEE and make it read-only.
3. Move link minting into the data layer and backfill.
4. List the kosztorysy (it needs the tokens from phase 3).
5. Fix the docs.

## Critical Implementation Details

- **Composition order is a security property.** URL filters stay at the top level and the scope goes
  only into `and`. Spreading the scope instead (`{ ...urlFilters, or: … }`) lets `?sourceRegister=`
  overwrite it, because the kasa filter also writes `where.or`. One builder must own this, and the
  page and the action must not each assemble it.
- **Mint concurrency.** The in-transaction `ON CONFLICT DO NOTHING` can race with a manager's
  `ensureWorkerLinkAction` (`payload.create` outside the transaction). Both outcomes are fine: the
  loser either skips or catches and re-reads. Rows that conflict inside the same statement are fine
  with `DO NOTHING`; only `DO UPDATE` errors on them.

## Phase 1: Transfer scope foundation

### Overview

`where-to-sql` accepts `and`. One function builds the worker's transfer `Where`, and the worker page
(manager view, still management-only) switches to it.

### Changes Required:

#### 1. `and` in the SQL translator

**File**: `src/lib/db/where-to-sql.ts`

**Intent**: Render `and: Where[]` as a parenthesised conjunction of sub-conditions, recursing like
`or`. Without it the sum tile throws on the new shape.

**Contract**: `renderField('and', Where[])` → `(<sub> AND <sub>)`. Each sub-`Where` may hold several
keys, including a nested `or`. An empty or non-array value throws, like `or`.

#### 2. Worker transfer scope

**File**: `src/lib/queries/worker-transfers.ts` (new; pure functions, no `server-only` needed for the builder)

**Intent**: Give the page and the action one place to compute „transfers touching this worker".

**Contract**:

- `workerTransferScope(workerId, registerIds): Where` returns `{ or: [{ worker: { equals: id } },
{ sourceRegister: { in: ids } }, { targetRegister: { in: ids } }] }`, leaving out both kasa
  branches when `registerIds` is empty.
- `buildWorkerTransferWhere(urlFilters, scope): Where` returns `{ ...urlFilters, and: [scope] }`.
- The visible-kasy set is `ownedRegisters(refData.cashRegisters, workerId)
.filter(canViewRegister(viewerRole, …))`. The page's „Przypisane kasy", the scope and the kasa
  filter all use this one set. Extract it into a helper only if the page and the action would
  otherwise each repeat it.

#### 3. Worker page uses the scope

**File**: `src/app/(frontend)/pracownicy/[id]/page.tsx`

**Intent**: Replace the spread `worker: { equals }` with the scope builder. Narrow the kasa filter to
his kasy.

**Contract**: `filters: { ...buildFilterConfig(refData, [...]), cashRegisters: registers.map(({ id, name }) => ({ id, name })) }`.

#### 4. Test-plan risk

**File**: `context/foundation/test-plan.md` (through `/10x-test-plan`)

**Intent**: Add risk **#22**: an EMPLOYEE sees or downloads beyond his scope (a foreign worker page, a
foreign kasa, a URL filter or client channel that widens the transfer scope). Anchor the specs below
on it.

### Success Criteria:

#### Automated Verification:

- `where-to-sql.test.ts`: `and` renders parenthesised, nests `or`, and throws on an empty or non-array value.
- New `src/__tests__/lib/queries/worker-transfers.test.ts`: the scope shape, no `IN ()` without kasy,
  `?sourceRegister=` / `?worker=` / investment filter only narrow (they stay top-level and the scope stays in `and`).
- `transfer-filters.test.ts` bridge: the worker `Where` goes through `stripCancelledFilters` and the
  translator into SQL containing both URL conditions and the scope.
- test-plan.md has risk #22 with its response row.

#### Manual Verification:

- As a manager, `/pracownicy/<Nikolajewicz>` lists zaliczki onto kasa 37 and expenses from it,
  alongside payouts. The sum tile matches the list with no filter and with a kasa filter.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Employee access and read-only page

### Overview

EMPLOYEE reaches only his own page, with nothing that would refuse him. Faktury/Drukuj get a
server-scoped channel.

### Changes Required:

#### 1. Gates

**Files**: `src/app/(frontend)/(dashboard)/page.tsx`, `src/app/(frontend)/pracownicy/[id]/page.tsx`,
`src/app/(frontend)/kasa/[id]/page.tsx`, `src/lib/queries/equipment.ts`

**Intent**:

- Dashboard: an EMPLOYEE is redirected to `/pracownicy/${user.id}`. This removes the 404 for workers
  without a `WORKER` kasa.
- Worker page: `requireAuth(ROLES)`; an EMPLOYEE whose `id !== user.id` gets `notFound()`.
- `/kasa/[id]`: `requireAuth(MANAGEMENT_ROLES)`. An EMPLOYEE gets `notFound()` (decision 5), while a
  missing session still redirects to `/zaloguj`. Drop the now-dead owner check (`:58-59`) and the
  `isManager` branches.
- `fetchEquipmentAtLocation`: also admit EMPLOYEE when `target.kind === 'holder' && target.id === user.id`.

**Contract**: page access = `isManagementRole(role) || (role === 'EMPLOYEE' && id === user.id)`.

#### 2. Read-only rendering for EMPLOYEE

**Files**: worker page, `src/components/users/owned-registers-section.tsx`,
`src/components/equipment/held-equipment-section.tsx`, `src/components/tables/transfers.tsx`,
`src/components/transfers/invoice-cell.tsx`, `src/app/(frontend)/@investmentCrumb/pracownicy/[id]/page.tsx`

**Intent**: Take away every control that would refuse him.

- `EditWorkerDialog` renders only for management.
- Kasa and sprzęt names in the two sections become plain text (a `linkable` prop; one consumer each).
- `excludeColumns` adds `'actions'` for EMPLOYEE.
- Register cells in the transfers table render as plain text for a non-management viewer, so there is
  no 404 link. Investment links stay (decision 3).
- `InvoiceCell` is preview-only for a non-management viewer: no „+", no upload dialog, and
  `MediaPreviewButton` without `onAdd`/`onRemove`. Do **not** set `skipMedia`.
- The crumb renders nothing for EMPLOYEE.

**Contract**: the role comes from `useCurrentUser()` in client cells and from the session in server
components. Management rendering stays exactly as it is.

#### 3. Worker-scoped Faktury/Drukuj

**Files**: `src/lib/queries/fetch-transfers-for-invoices.ts`,
`src/components/transfers/invoice-download-button.tsx`, `print-transfers-button.tsx`,
`transfer-data-table.tsx`, `transfer-table-config.ts`

**Intent**: The worker page's buttons call a channel that rebuilds the scope on the server from the
worker id and the URL params, never from a client `Where`. `fetchFilteredTransfers` stays
management-only and unchanged in behaviour.

**Contract**:

- New `'use server'` `fetchWorkerTransfers(workerId: number, params: Record<string, string>, opts)`.
  Gate: management, or an EMPLOYEE with `workerId === user.id`. Body: `buildTransferFilters(params,
…)`, then the visible-kasy set for the session role, then `buildWorkerTransferWhere`, then the same
  cancelled/CANCELLATION exclusion and row fetch as `fetchFilteredTransfers`. Extract that shared tail
  instead of copying it.
- `TransferTableConfigT` gains `workerScope?: number`. When it is set, both buttons call
  `fetchWorkerTransfers(workerScope, <current search params>)`; otherwise they call
  `fetchFilteredTransfers(where)` as today. The worker page sets it in both views, so manager and
  worker downloads share one path.

### Success Criteria:

#### Automated Verification:

- `fetchWorkerTransfers` spec (mocked session + row fetch): an EMPLOYEE with a foreign id is refused;
  an EMPLOYEE with his own id gets the scope in `and`, even when the params carry
  `sourceRegister=<foreign kasa>`; management is accepted.
- `fetchEquipmentAtLocation` gate spec: EMPLOYEE self-holder is allowed; a foreign holder and a warehouse are refused.
- DOM spec for `InvoiceCell` (or the columns) as EMPLOYEE: no upload button, preview present.

#### Manual Verification:

- Local, as Nikolajewicz (`nikolajkewicz@wp.pl` / `test`, local DB only):
  - `/` lands on his page;
  - another worker's id and `/kasa/37` give 404;
  - no edit, cancel or upload controls, and kasa/sprzęt names are not links;
  - clicking an investment returns to his page;
  - Faktury downloads only his invoices;
  - Drukuj prints his rows.
- As a manager the worker page is unchanged apart from the wider transfer list and the narrowed kasa filter.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Automatic report link

### Overview

Assigning a worker to an etap mints his inwestycja × pracownik link in the same transaction. One
migration backfills the existing pairs. The manager's menu becomes rotation-only.

### Changes Required:

#### 1. Mint in the chokepoint

**Files**: `src/lib/db/stage-split.ts`, `src/lib/kosztorys/share-token.ts`

**Intent**: After inserting members, insert one share row per distinct (inwestycja, pracownik),
skipping existing pairs. This covers dodaj etap, zmiana składu, akceptacja zgłoszenia, import and
przywrócenie wersji.

**Contract**: export the token generator from `share-token.ts` (`newShareToken()`, reused by
`writeShareToken`). In `insertStageMembers`:
`INSERT INTO worker_report_shares (investment_id, worker_id, token) SELECT ks.investment_id, v.worker_id, v.token
FROM (VALUES …) v(stage_id, worker_id, token) JOIN kosztorys_stages ks ON ks.id = v.stage_id
ON CONFLICT (investment_id, worker_id) DO NOTHING`. The signature does not change. The JOIN resolves the inwestycja.

#### 2. Backfill migration

**File**: `src/migrations/20261005_2_backfill_worker_report_shares.ts` (+ `index.ts`), hand-written after the latest file

**Intent**: One row for every existing pair in `kosztorys_stage_workers × kosztorys_stages`, for all
statuses (the mint is unconditional).

**Contract**: `INSERT … SELECT DISTINCT ks.investment_id, ksw.worker_id,
replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','') … ON CONFLICT
(investment_id, worker_id) DO NOTHING`. `down` is a no-op: minted links cannot be told apart from
manual ones.

#### 3. Rotation-only menu

**Files**: `src/lib/actions/kosztorys-worker-share.ts`,
`src/components/kosztorys/editor/dialogs/share/share-link-panel.tsx`,
`kosztorys-worker-share-dialog.tsx`, `kosztorys-workers-menu.tsx` / `worker-actions.tsx` as needed

**Intent**:

- `writeWorkerLink` no longer refuses a blocked scope; `/z/` already shows the notice.
- `revokeWorkerLinkAction` is deleted.
- `ShareLinkPanel`'s `revoke`/`revokeTitle`/`revokeDescription` become optional as one group, and the
  investor dialog keeps passing them.
- In the worker dialog, `blockReason` is shown as a note above the normal link + „Wygeneruj nowy", not
  as a branch that hides the link.
- The menu's „Link do zgłoszeń" is no longer disabled for a blocked worker.
- Workers „with a link, no etap" stay in the menu (decision 6). Delete whatever becomes dead
  (`dropLinkHolder` if unused); typecheck is the gate.

**Contract**: the investor share dialog's behaviour is unchanged.

### Success Criteria:

#### Automated Verification:

- DB spec (`kosztorys-stages.test.ts` or a new `stage-split` DB spec):
  - adding an etap with a worker creates one share;
  - a second etap on the same inwestycja keeps the same token;
  - `replaceStageSplit` keeps the token;
  - a template / no-stage path creates none.
- `worker-share-token.test.ts`: the blocked-scope case now mints; the revoke cases are removed.
- `kosztorys-workers-menu.test.tsx`: a blocked worker's item is enabled, and there is no „Wyłącz link".
- The migration applies to the local docker DB (`git status src/migrations` first). A SQL check then
  shows 0 pairs without a share.
- test-plan.md risk #19 is revised: links are minted despite a block, and the send is still refused
  (`token-action.test.ts`).

#### Manual Verification:

- In the editor, adding a worker to an etap makes „Link do zgłoszeń" show a link at once. A blocked
  worker shows the reason plus the link, and opening it shows the notice on `/z/`.
- The investor „Udostępnij" still offers „Wyłącz link".

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Worker's kosztorys list

### Overview

A „Kosztorysy" section on the worker page, for both views, listing his inwestycje with their `/z/` links.

### Changes Required:

#### 1. Query

**File**: `src/lib/db/stage-memberships.ts` (+ an uncached read in `src/lib/queries`)

**Intent**: The worker's inwestycje via etap membership, with the share token.

**Contract**: the `research.md` §7 SQL with `DISTINCT` per inwestycja,
`i.status IN ('active','planowana','quote') AND i.trashed_at IS NULL`, ordered by name. Returns
`{ investmentId, name, status, token | null }[]`.

#### 2. Section

**File**: new `src/components/users/worker-kosztorysy-section.tsx`, rendered on the worker page

**Intent**: Each row shows the investment name, its status label (`investment-status.ts`) and a
„Zgłoś prace" link to `workerReportShareUrl(FRONTEND_URL, name, workerName, token)`. A missing token
shows „brak linku" (should not happen after phase 3). The empty state is a `Description`. The layout
follows the sibling summary sections and stays usable at 390px.

### Success Criteria:

#### Automated Verification:

- DB spec on the query:
  - a completed, trashed or template inwestycja is excluded;
  - `quote` and `planowana` are included;
  - one row per inwestycja when the worker is in several etapy;
  - the token is joined.

#### Manual Verification:

- At 390px, Nikolajewicz sees his 3 active inwestycje (not the 2 completed). Each link opens his `/z/` page.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: Docs

### Changes Required:

- `AGENTS.md`:
  - phone scope gets a second exception, `/pracownicy/[id]` for EMPLOYEE, checked at 390px;
  - Auth gets one sentence: EMPLOYEE lands on and may read only his own `/pracownicy/[id]`, and
    `/kasa/[id]` is management-only.
- `context/foundation/lessons.md:723`: replace the stale „translator fails OPEN" lesson. The translator
  now throws, and `and` is supported.
- `context/reference/outgoing-effects-isolation.md`: no change (no new outgoing effect).

### Success Criteria:

#### Automated Verification:

- No automated check: prose-only phase.

#### Manual Verification:

- AGENTS.md and lessons.md read correctly against the shipped code.

---

## Testing Strategy

### Unit Tests:

- Translator `and`; scope builder monotonicity and empty-kasy shape; `fetchWorkerTransfers` and
  equipment gates with a mocked session.

### Integration Tests:

- The mint across `insertStageMembers` paths; the kosztorys-list query; the migration backfill (manual
  SQL check on the local DB).

### Manual Testing Steps:

1. Run the phase 2 checks as Nikolajewicz locally, then as a manager.
2. Run the phase 3 editor checks.
3. Run the phase 4 check at 390px.

E2E: a browser spec (EMPLOYEE login → own page → foreign id 404) is owed by the review gate. Either
author it with `/10x-e2e` or file it under `e2e-backlog`.

## Migration Notes

The backfill is additive and data-only: the new code works without it (the list shows „brak linku").
Prod can be migrated before or after the push. A human runs `pnpm db:migrate:prod`, and the preview DB
needs `pnpm db:migrate:preview` after merge to staging.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (unit + DOM; only when asked, per standing rule)
- `pnpm test:integration` (DB specs, pre-push)

## References

- Research: `context/changes/2026-10-05-worker-account/research.md`
- Composition precedent: `src/app/(frontend)/kasa/[id]/page.tsx:35-43`
- Chokepoint: `src/lib/db/stage-split.ts:35-49`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Transfer scope foundation

#### Automated

- [x] 1.1 `where-to-sql.test.ts` covers `and` — b571e7f0
- [x] 1.2 `worker-transfers.test.ts` covers scope shape and monotonicity — b571e7f0
- [x] 1.3 `transfer-filters.test.ts` bridge covers the worker `Where` — b571e7f0
- [x] 1.4 test-plan.md risk #22 added — b571e7f0

### Phase 2: Employee access and read-only page

#### Automated

- [x] 2.1 `fetchWorkerTransfers` gate + scope spec
- [x] 2.2 `fetchEquipmentAtLocation` gate spec
- [x] 2.3 Read-only invoice cell DOM spec

### Phase 3: Automatic report link

#### Automated

- [ ] 3.1 Mint DB spec across `insertStageMembers` paths
- [ ] 3.2 `worker-share-token.test.ts` updated (blocked mints, revoke removed)
- [ ] 3.3 `kosztorys-workers-menu.test.tsx` updated
- [ ] 3.4 Migration applied locally, 0 pairs without a share
- [ ] 3.5 test-plan.md risk #19 revised

### Phase 4: Worker's kosztorys list

#### Automated

- [ ] 4.1 Kosztorys-list query DB spec

### Phase 5: Docs

#### Automated

- [ ] 5.1 None (prose-only)
