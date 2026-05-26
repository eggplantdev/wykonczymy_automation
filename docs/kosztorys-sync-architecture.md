# Kosztorys ↔ Google Sheets — Architecture

> Sister document to `docs/plans/2026-05-20-kosztorys-b-iframe-poc-build.md`.
> The plan is the recipe; this doc is the **rationale** — what we built, why
> we built it this way, and how it slots into the existing system.

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
        │  4. void syncSingleTransferToSheet({intent: 'CREATE'})   ◀── fire-and-forget
        │                                                              (no UI wait)
        ▼
   syncSingleTransferToSheet
        │
        ├─ skip if type ≠ INVESTMENT_EXPENSE
        ├─ skip if category ≠ Materiały budowlane/wykończeniowe
        ├─ skip if investment.googleSheetId is empty
        │
        ▼
   googleapis client (service-account JWT)
        │
        ├─ values.append → 'materiały '!B:C or F:G  (amount, "desc [date]")
        └─ values.update → 'materiały '!I{row}      (transferId)   ◀── join key

                                          ┌──────────────────────────────┐
                                          │   Google Sheet  (kosztorys)  │
                                          │                              │
                                          │   tab 'materiały '           │
                                          │   ├─ A..H human-friendly     │
                                          │   └─ I  transferId (app-owned) │
                                          └──────────────────────────────┘

   Cancel path is symmetric: intent: 'DELETE' → read col I → deleteDimension that row.

   Drift recovery: SyncButton on /inwestycje/[id]/kosztorys
        previewMaterialSync  →  diff{toAppend, toDelete, orphans}
        confirm → applyMaterialSync (idempotent re-check before each write)

   Provisioning: createInvestmentAction (or banner button) → drive.files.copy
        from KOSZTORYS_TEMPLATE_SHEET_ID → write back to investments.googleSheetId
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

Column **I** in `materiały ` stores the Postgres `transferId` as a number.
Nothing else does — there's no embedded ID in the description, no naming
convention, no hash.

Why this matters:

- **Append is two API calls**, not one. `values.append` writes amount +
  description to `B:C` (budowlane) or `F:G` (wykończeniowe). The response
  tells us which row got written, then `values.update` puts the
  `transferId` into `I{rowNumber}`. Splitting the writes leaves columns
  D–H untouched — owner-typed comments and settled flags survive.
- **Delete is a lookup**, not a guess. `deleteMaterialRowByTransferId`
  reads col I, finds the row whose I-cell equals the target id, and runs
  `deleteDimension`. No reliance on row order, no fuzzy matching by
  amount+description.
- **Diff is set algebra**, not heuristics. `previewMaterialSync` reads
  col I once, builds `Map<transferId, rowIndex>`, then compares to the
  Postgres set:
  - `appIds \ sheetIds` → `toAppend`
  - `sheetIds ∩ {cancelled or missing in DB}` → `toDelete`
  - `sheetIds \ appIds` where the transfer doesn't exist at all →
    `orphans` (surfaced but never auto-deleted, see §6)

A row without a `transferId` in col I is, by construction, owner-typed
content. The reconciler will never touch it — which is the whole point.

---

## 3. Write paths

### 3a. Auto-push on create (fire-and-forget)

`createTransferAction` and `createBulkTransferAction` end with:

```ts
void syncSingleTransferToSheet({ transferId: created.id, intent: 'CREATE' })
```

The `void` is **load-bearing**. Awaiting the Sheets API would block the
user-visible action on Google's latency for every transfer — including
the non-Materiały ones where the sync is a no-op. The user sees a fast
green check; the sheet catches up within a few seconds; if the sheet
write fails, the next preview→confirm will reveal the drift.

Bulk creates fire **per-row**, **after commit** — never before, because a
rolled-back row must not leak into the sheet.

### 3b. Auto-push on cancel (fire-and-forget)

`cancelTransferAction` marks the original row `cancelled: true`, creates
the CANCELLATION audit row, then fires:

```ts
void syncSingleTransferToSheet({ transferId, intent: 'DELETE' })
```

Same fire-and-forget shape. The sheet row disappears within seconds, or
the next reconcile picks it up.

### 3c. Reconciliation — the sync button (two-phase)

Why two phases (preview → confirm) instead of one button that just
"syncs"?

- The owner is editing the sheet manually in parallel. A one-click sync
  could silently delete a row the owner _just_ added (because that row
  has no `transferId` in col I yet — it'd look like an orphan, but the
  reconciler explicitly does **not** delete orphans, so this particular
  scare is moot; still, the explicit preview is a trust-builder).
- The diff is the audit trail. The owner sees exactly what changed before
  it changes. After the trial we may collapse this to a one-button flow
  if nobody ever cancels at the preview step.
- `applyMaterialSync` re-reads col I once at the start, so a row that
  appeared between preview and confirm is **skipped, not duplicated**.
  This is **optimistic concurrency**: we don't lock the sheet, we just
  re-check the world before each write.

`MaterialSyncPreviewT` carries the `spreadsheetId` it was computed
against. `applyMaterialSync` refuses to apply if the investment's
`googleSheetId` changed in the meantime — a small but cheap guard
against accidentally applying a preview to the wrong sheet.

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

| Failure                                   | Behaviour                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Sheets API down on transfer create        | Action returns success. Log line. Owner triggers sync button later to fill the gap.                        |
| Sheets API down on transfer cancel        | Same. Drift surfaces in preview as `toDelete`.                                                             |
| Drive down on investment create           | Investment is created without `googleSheetId`. Banner appears. Owner clicks "Utwórz nowy kosztorys" later. |
| Service account loses access to a sheet   | Auto-push fails silently. Preview fails (visible error toast). Owner re-shares with the SA email.          |
| Owner manually deletes an app-managed row | Next reconcile sees it in `toAppend` — pushes it back. Owner gets used to "stop deleting those."           |
| Owner manually edits an app-managed row   | We don't notice. Source of truth is Postgres; the sheet edit decays on next reconcile.                     |
| Owner adds their own row without col I    | Reconciler classifies as **orphan**. **Never auto-deleted.** Surfaced in preview for owner awareness only. |
| `transferId` collision in col I           | Impossible — Postgres ids are monotonic per table, and only this code writes col I.                        |

What we **don't** accept:

- Silent corruption of human-typed data. The split-writes pattern (B:C
  then I) is specifically chosen so we never overwrite columns D–H.
- Duplicate app-managed rows for the same transfer. The
  `current.has(transferId)` re-check in `applyMaterialSync` guards
  against the race where preview→confirm overlapped an auto-push.

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
src/lib/google/sheets.ts                                         ← appendMaterialRow, deleteMaterialRowByTransferId, readMaterialyTransferIds
src/lib/google/drive.ts                                          ← createKosztorysFromTemplate
src/lib/actions/utils.ts                                         ← protectedAction now generic over TData
src/lib/actions/sheets-sync.ts                                   ← preview / apply / syncSingleTransferToSheet
src/lib/actions/transfers.ts                                     ← fire-and-forget sync after create/bulk-create/cancel
src/lib/actions/investments.ts                                   ← auto-provision on create + provisionKosztorysAction
src/collections/investments.ts                                   ← googleSheetId text field
src/migrations/20260525_add_google_sheet_id_to_investments.ts    ← ADD COLUMN nullable
src/app/(frontend)/inwestycje/[id]/layout.tsx                    ← mounts banner
src/app/(frontend)/inwestycje/[id]/no-sheet-banner.tsx           ← two-CTA banner
src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx            ← server: iframe or null
src/app/(frontend)/inwestycje/[id]/kosztorys/iframe-view.tsx     ← client: iframe wrapper
src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx     ← client: preview→confirm dialog
src/__tests__/lib/google/sheets.test.ts                          ← mocked unit tests
src/__tests__/lib/google/drive.test.ts                           ← mocked unit tests
```
