# Kosztorys ↔ Google Sheets — Architecture

> Sister document to `docs/plans/2026-05-20-kosztorys-b-iframe-poc-build.md`.
> The plan is the recipe; this doc is the **rationale** — what we built, why
> we built it this way, and how it slots into the existing system.

> **⚠️ Partially superseded (2026-05-27).** Two redesigns landed after this
> doc was first written:
>
> 1. **Single tidy table + append-only.** The wide two-block layout (`B:C` /
>    `F:G` + col I) is gone. There is now ONE long table on the
>    `wydatki inwestycyjne (tylko do odczytu)` tab, columns located by header
>    text (see `docs/plans/2026-05-27-kosztorys-header-driven-sync.md`). The
>    sync is **append-only**: cancellations append a negative reversing row;
>    nothing is ever deleted. So `deleteMaterialRowByTransferId`,
>    `toDelete`, `orphans`, and the `intent` param described below **no longer
>    exist**. The join key is the `id` column (any position), not col I.
> 2. **Link an existing sheet, not copy a template.** Provisioning via
>    `drive.files.copy` (§4) is replaced by linking an owner-shared sheet
>    (`sheet-access.ts` + setup that attaches the tab) — the service account
>    has no Drive storage quota on a personal account. The `layout.tsx` /
>    `no-sheet-banner.tsx` files in §5d/file-map were deleted.
>
> §2/§3/§6 below are corrected for #1. §4/§5d describe the old provisioning
> flow and are left for historical rationale only.

---

## TL;DR — the flow in one page

```
                                          ┌──────────────────────────────┐
   User clicks "Dodaj wydatek"            │  Existing Payload + Postgres │
   in the app                             │   (single source of truth)   │
        │                                 │                              │
        ▼                                 │   - transactions             │
   createTransferAction (server action)   │   - investments              │
        │                                 │       └─ googleSheetId       │
        │  1. validate + auth (protectedAction wrapper)
        │  2. payload.create → row in `transactions`
        │  3. revalidate transfers cache
        │  4. after(() => syncSingleTransferToSheet({transferId}))  ◀── post-response
        │                                                              (Vercel keeps the
        ▼                                                              fn alive to finish)
   syncSingleTransferToSheet
        │
        ├─ INVESTMENT_EXPENSE → build + row    │ skip if no expenseCategory
        ├─ CANCELLATION       → build − row    │ (reverses the original expense)
        ├─ skip if investment.googleSheetId is empty
        │
        ▼
   googleapis client (service-account JWT)
        │
        └─ readGrid → resolveHeaders (locate cols by header text)
           → appendMaterialRow: write the 7 mapped cells at the next empty row
             (id is the join key; one row per transferId)

                                          ┌──────────────────────────────┐
                                          │   Google Sheet  (kosztorys)  │
                                          │                              │
                                          │  tab 'wydatki inwestycyjne   │
                                          │       (tylko do odczytu)'    │
                                          │  one long table, header-driven│
                                          │  + RAZEM/per-type SUMIF block │
                                          └──────────────────────────────┘

   Cancel path is append-only: a CANCELLATION appends a − reversing row (same
   typ as the original, its own id). The + row stays — the sheet is an audit log.

   Drift recovery: SyncButton on /inwestycje/[id]/kosztorys
        previewMaterialSync  →  {toAppend}   (display only)
        confirm → applyMaterialSync RE-DERIVES toAppend server-side, then appends

   Provisioning (superseded): link an owner-shared sheet via sheet-access.ts;
        setup attaches + (re)builds the read-only tab. Old flow was drive.files.copy.
```

**One-sentence summary:** Postgres is the source of truth. The sheet is a
**materialized view** that the app keeps in sync, with a manual reconciler
button to repair drift, and a join key (col I = `transferId`) so the
reconciler is deterministic.

---

## 1. Why two sources of truth at all?

We deliberately do _not_ eliminate the Google Sheet, and we deliberately do
_not_ eliminate Postgres. Each one carries weight the other can't:

| Concern                                    | Postgres                          | Google Sheet                   |
| ------------------------------------------ | --------------------------------- | ------------------------------ |
| Authoritative ledger of money flows        | ✅ (FK constraints, audit, hooks) | ❌ (anyone can edit a cell)    |
| Shareable, multi-user editing without auth | ❌                                | ✅ (Drive sharing model)       |
| Familiar to non-technical owner            | ❌                                | ✅                             |
| Free-form notes, columns, formulas         | ❌ (schema is fixed)              | ✅                             |
| Aggregations + reports                     | ✅ (SQL)                          | ✅ (SUM cells in Podsumowanie) |

The compromise: **the app owns a narrow slice of the sheet** (the
`materiały ` tab's auto-pushed rows, keyed by col I). Everything else —
labour, pokoje, formulas, owner-typed comments — stays as free-form
"sheet land" and the app never touches it.

This is the same idea as a **read model in CQRS**: the source of truth
stays normalised and consistent; the read model is denormalised and
optimised for a different audience (here, the owner working in Sheets).

---

## 2. Identity — how a row knows which transfer it is

The **`id` column** (located by its header text, not a fixed position)
stores the Postgres `transferId` as a number. Nothing else does — no
embedded ID in the description, no naming convention, no hash.

Why this matters:

- **Header-driven, not positional.** `resolveHeaders` scans the top rows,
  finds the row that contains all seven fields (id, data, typ, opis, kwota,
  kategoria, notatka) and maps each to its column. The owner can reorder
  columns or add their own; the code still finds the right cells. It
  fail-loud throws if the header is missing rather than writing to the
  wrong column.
- **Append writes only the seven mapped cells** at the next empty row
  (one past the last id below the header). The summary block, formulas,
  and any owner columns are never touched.
- **Append-only — no delete.** A cancellation does not remove the original
  row; it appends a negative reversing row (same `typ`, amount = −original,
  its own id, reason in the note). The sheet reads like a double-entry
  ledger / `git revert`: history is preserved, the running `RAZEM` total
  still nets correctly.
- **Diff is one set difference.** `previewMaterialSync` reads the id column
  into `Set<transferId>`, then `appRows.filter(r => !sheetIds.has(r.id))`
  → `toAppend`. There is no `toDelete` and no `orphans`: rows the app
  doesn't recognise are the owner's own data, left untouched.

A row without a recognised `id` is, by construction, owner-typed content.
The reconciler never touches it — which is the whole point.

---

## 3. Write paths

### 3a. Auto-push on create (post-response via `after()`)

`createTransferAction` and `createBulkTransferAction` end with:

```ts
after(() => syncSingleTransferToSheet({ transferId: created.id }))
```

Why `after()` and not a bare `void`? Awaiting the Sheets API inline would
block the user-visible action on Google's latency for every transfer —
including the non-Materiały ones where the sync is a no-op. But a bare
`void` promise can be **frozen or killed when the serverless function
returns** on Vercel, silently dropping the write. `after()` (from
`next/server`) runs the work after the response is sent yet keeps the
function alive to finish it. Drift is still recoverable via the sync button.

Bulk creates run **after commit** (never before — a rolled-back row must
not leak into the sheet) and **serialized** — `await` per row inside one
`after()` callback. Not N parallel calls: each `appendMaterialRow` reads
the sheet to find the next empty row, so parallel appends would all target
the same row and overwrite each other.

### 3b. Auto-push on cancel (post-response, append-only)

`cancelTransferAction` marks the original row `cancelled: true`, creates
the CANCELLATION audit row, then:

```ts
after(() => syncSingleTransferToSheet({ transferId: cancellation.id }))
```

This appends a **negative reversing row** for the cancellation (the
original + row stays). Append-only: the sheet keeps the full history.

### 3c. Reconciliation — the sync button (two-phase)

Why two phases (preview → confirm) instead of one button that just
"syncs"? The diff is the audit trail — the owner sees exactly what will be
added before it's added. The preview shows only `toAppend` (append-only;
nothing is deleted), so it's a low-stakes "these N rows will appear" list.

**`applyMaterialSync` re-derives the rows to append SERVER-SIDE** — it does
NOT trust the `toAppend` the browser holds. It reloads the DB rows via
`loadAppMaterialRows`, re-reads the sheet's id column, and appends only
`appRows \ sheetIds`. The client preview is display-only: a forged
`toAppend` (arbitrary typ/amount/description) can't reach the sheet. Reads
are fresh on apply, so a row that appeared between preview and confirm is
naturally excluded — optimistic concurrency, no sheet lock.

---

## 4. Provisioning a fresh sheet

Two entry points, one underlying function (`createKosztorysFromTemplate`
in `src/lib/google/drive.ts`):

| Trigger                             | Mode            | Why                                                |
| ----------------------------------- | --------------- | -------------------------------------------------- |
| `createInvestmentAction`            | fire-and-forget | The create UX must stay fast; sheet appears soon.  |
| `provisionKosztorysAction` (banner) | awaited         | User clicked a button and is waiting for feedback. |

Both call `drive.files.copy({ fileId: KOSZTORYS_TEMPLATE_SHEET_ID, … })`,
rename the copy to `Kosztorys – {investmentName}`, optionally drop it
into `KOSZTORYS_DRIVE_FOLDER_ID`, then write the new file's ID back to
`investments.googleSheetId`.

**No backfill.** Investments created before this lands stay unlinked
until someone either pastes a sheet ID via admin, or clicks "Utwórz nowy
kosztorys" on the banner. Investment 31 is the working example of the
manual-paste path for the PoC trial.

**Service account scope is `drive.file`**, not full Drive. The service
account can only see files it created or that were explicitly shared
with it. If the JSON key leaks, the blast radius is limited to:

- the template (shared with it → Editor on that one sheet)
- every sheet it has provisioned (it owns those)
- any sheet a human shared with it later (currently: investment 31's)

Narrower than handing out an OAuth refresh token for a human user.

---

## 5. How this connects to the existing system

No new collections, no new DB tables, no new infrastructure. Everything
slots into existing patterns:

### 5a. Server actions, not Payload hooks

Per CLAUDE.md, all mutations go through `protectedAction()` in
`src/lib/actions/`. The Sheets side effect lives there, **not** in a new
`afterChange` hook on the transactions collection.

Why this matters:

- Hooks fire in Route Handler context where `updateTag()` throws. Server
  actions don't have that constraint.
- A hook would run on _every_ `payload.update`, including admin edits,
  background migrations, internal scripts. The server action only fires
  on the user-initiated paths we explicitly wired up.
- Server actions own the perf log + auth + cache revalidation in a
  single wrapper. Putting the sync there keeps that flow intact.

(Memory: [[feedback_server_actions_over_payload_hooks]] — same principle.)

### 5b. Env validation at startup

`src/lib/env.ts` validates three new vars at boot via Zod:

```
GOOGLE_SERVICE_ACCOUNT_JSON   (must be JSON with client_email + private_key)
KOSZTORYS_TEMPLATE_SHEET_ID   (string)
KOSZTORYS_DRIVE_FOLDER_ID     (optional)
```

A bad paste fails at `pnpm dev` boot, not at the first hook invocation
hours later in production. This is **fail-fast**: errors surface at the
moment a human is most likely to be looking at the logs.

### 5c. Payload field

`Investments.googleSheetId` is just a nullable `text` field with a
descriptive admin label. The migration is a one-liner:

```sql
ALTER TABLE investments ADD COLUMN IF NOT EXISTS google_sheet_id varchar;
```

`payload generate:types` picks up the new field. No code change needed
in any consumer of `Investment` — TypeScript will narrow `googleSheetId`
to `string` once you check it for truthy.

### 5d. Routing

```
/inwestycje/[id]/                       ← existing detail page (transfers list, stats)
/inwestycje/[id]/layout.tsx             ← NEW: mounts NoSheetBanner if !googleSheetId
/inwestycje/[id]/kosztorys/page.tsx     ← NEW: iframe or null
/inwestycje/[id]/no-sheet-banner.tsx    ← NEW: client component, banner with two CTAs
```

The layout fetches the investment via `getInvestment(id)` from
`src/lib/queries/investments.ts`. That query is wrapped in
`unstable_cache` with tag `CACHE_TAGS.investments`, so the cold-path
double-fetch (layout + page each call their own data source) becomes a
warm-path zero-cost.

### 5e. Cache invalidation

`previewMaterialSync` is read-only — no `revalidate` argument.
`applyMaterialSync` and `provisionKosztorysAction` pass
`['transfers']` / `['investments']` to `protectedAction`, which calls
`revalidateCollections()` → `updateTag()` (not `revalidateTag`!) inside
the server action wrapper. Same machinery as every other mutation in
the app.

(Memory: [[feedback_updatetag_not_revalidatetag]] — server actions use
`updateTag`, hooks use `revalidateTag`.)

### 5f. Role gating

`protectedAction` calls `requireAuth(MANAGEMENT_ROLES)`. The sync
button, banner CTAs, preview / apply actions, and provisioning actions
are all gated to `ADMIN | OWNER | MANAGER`. Employees can't trigger
sheet writes, can't reconcile, can't provision.

### 5g. `protectedAction` made generic

The only meta-change: `protectedAction<TData = undefined>` now lets a
handler return data through the wrapper without losing auth + perf +
revalidation. Default `TData = undefined` keeps every existing caller
unchanged. `previewMaterialSync` and `provisionKosztorysAction` use it
to ship their `MaterialSyncPreviewT` / `{sheetId}` payload back to the
client.

---

## 6. Failure modes — what we accept and what we don't

| Failure                                    | Behaviour                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Sheets API down on transfer create         | Action returns success. Log line. Owner triggers sync button later to fill the gap.                         |
| Sheets API down on transfer cancel         | Same. The missing − row reappears in the next preview's `toAppend`.                                         |
| Drive down on investment create            | Investment is created without `googleSheetId`. Banner appears. Owner links a sheet later.                   |
| Service account loses access to a sheet    | Auto-push fails silently. Preview fails (visible error toast). Owner re-shares with the SA email as Editor. |
| Owner manually deletes an app-managed row  | Next reconcile sees it in `toAppend` — pushes it back. Owner gets used to "stop deleting those."            |
| Owner manually edits an app-managed row    | We don't notice (append-only never rewrites a synced row — review finding #4). Surface a re-sync later.     |
| Owner adds their own row (unrecognised id) | Left untouched. The reconciler only ADDS missing app rows; it never deletes or flags owner rows.            |
| `transferId` collision in the id column    | Impossible — Postgres ids are monotonic per table, and only this code writes the id column.                 |

What we **don't** accept:

- Silent corruption of human-typed data. Append-only + writing only the
  seven mapped cells means owner columns and the summary are never touched.
- Duplicate app-managed rows for the same transfer. `applyMaterialSync`
  re-reads the id column and filters `appRows \ sheetIds` before appending,
  so a row already present is never re-added.

---

## 7. What we explicitly did NOT build (and why)

- **Outbox table.** Would give us at-least-once delivery for sheet
  writes (DB write + outbox row in same tx, background worker drains).
  Rejected because the reconciler covers the same gap with no extra
  schema — and the PoC's blast radius is one investment, not millions.
  Revisit if the trial reveals drift is common, or if we want sub-second
  recovery.
- **Webhook from Sheets → app.** Google has Drive push notifications,
  but two-way sync would mean reconciling sheet edits back into Postgres
  — a huge scope expansion. Sheet is read-only from the app's
  perspective; humans edit it, app pushes one direction only.
- **`afterChange` hook on transactions.** See §5a. The server-action
  layer owns the sync.
- **Materiały tab protection.** Sketched in the plan, intentionally
  deferred. The trial is partly to see whether human discipline + Drive
  sharing handle it without the lock.
- **Backfill for existing investments.** Auto-provisioning only kicks in
  for _new_ investments. Old ones use the banner's manual paths. Keeps
  the migration to a column add; no script needed.

---

## 8. Open questions / pending decisions

- **One-week owner trial gates everything below.** Don't change
  `sheets.ts`, `drive.ts`, `sheets-sync.ts`, or the auto-push wiring
  during the trial — let the owner experience the unchanged behavior so
  feedback is meaningful.
- **Materiały protection** — re-enable if owners accidentally edit
  app-managed rows during the trial.
- **Banner CTA simplification** — both "Powiąż istniejący" and "Utwórz
  nowy" shipped to see which one owners actually use. Drop the unused
  one after the trial.
- **Orphan handling** — if orphans pile up, add a "Convert orphan to
  transfer" affordance in the sync dialog instead of leaving them
  permanently noise in every preview.
- **Webhook from Sheets** — only if owners ask for "I changed it in the
  sheet, why doesn't the app see it" enough times.

---

## File map

```
src/lib/env.ts                                                   ← 3 new vars validated at boot
src/lib/google/auth.ts                                           ← service-account JWT factory (shared by sheets + drive)
src/lib/google/sheets.ts                                         ← appendMaterialRow, readMaterialyTransferIds, setupMaterialyTab (header-driven)
src/lib/google/sheet-access.ts                                   ← extractSheetId, verifySheetAccess (write-scope probe), serviceAccountEmail
src/lib/actions/utils.ts                                         ← protectedAction now generic over TData
src/lib/actions/sheets-sync.ts                                   ← preview / apply (server-side re-derive) / syncSingleTransferToSheet
src/lib/actions/transfers.ts                                     ← after() sync on create/bulk-create/cancel (bulk serialized)
src/lib/actions/investments.ts                                   ← link/setup kosztorys sheet actions
src/collections/investments.ts                                   ← googleSheetId text field
src/migrations/20260525_add_google_sheet_id_to_investments.ts    ← ADD COLUMN nullable
src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx            ← server: iframe or null
src/app/(frontend)/inwestycje/[id]/kosztorys/iframe-view.tsx     ← client: iframe wrapper
src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx     ← client: reset + sync dialogs
src/components/dialogs/kosztorys-setup-dialog.tsx                ← client: link-existing-sheet dialog
src/__tests__/lib/google/sheets.test.ts                          ← mocked unit tests
src/__tests__/lib/actions/sheets-sync.test.ts                    ← mocked unit tests
```
