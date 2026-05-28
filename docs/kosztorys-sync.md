# Kosztorys ↔ Google Sheets

> **Status: 2026-05-28.** Single source of truth for how the kosztorys ↔ sheet sync
> behaves **right now**. Edit this doc when behaviour changes. Older docs in
> `docs/plans/` capture rationale for individual redesigns and are not authoritative
> for current behaviour.

---

## One-paragraph summary

Postgres is the source of truth; the Google Sheet is a **materialised view** of an
investment's active expenses. The app owns one tab —
`wydatki inwestycyjne (tylko do odczytu)` — and mirrors into it **every non-cancelled
`INVESTMENT_EXPENSE`** for the investment, one row per transaction, keyed by the
Postgres `id`. Everything else on the sheet (other tabs, owner columns, manual rows)
is "sheet land" the app never touches. Writes are pushed automatically on
create/edit/cancel/delete via a Payload **collection hook** (so admin-panel edits
sync too), and a manual **Synchronizuj** button reconciles drift.

## Why two sources of truth at all?

| Concern                                       | Postgres                          | Google Sheet                            |
| --------------------------------------------- | --------------------------------- | --------------------------------------- |
| Authoritative ledger of money flows           | ✅ (FK constraints, audit, hooks) | ❌ (anyone with access can edit a cell) |
| Shareable, multi-user editing without our app | ❌                                | ✅ (Drive sharing model)                |
| Familiar to a non-technical owner             | ❌                                | ✅                                      |
| Free-form notes, columns, formulas            | ❌ (schema is fixed)              | ✅                                      |
| Aggregations & reports                        | ✅ (SQL)                          | ✅ (SUMIF on the summary block)         |

The compromise: **the app owns one narrow tab** (auto-pushed rows, keyed by the
`id` column). Everything else stays as free-form "sheet land" and the app never
touches it. Same idea as a **read model in CQRS** — the source of truth stays
normalised; the read model is denormalised for a different audience (the owner
working in Sheets).

---

## Data model

A kosztorys is its **own** collection (`kosztoryses`), separate from `investments`.
The kosztoryses row owns the sheet:

```
kosztoryses
├── id                serial PK
├── google_sheet_id   varchar UNIQUE NOT NULL
├── name              varchar NOT NULL            (defaults to the sheet's title)
├── investment_id     integer NULL  REFERENCES investments(id) ON DELETE SET NULL
└── created_at / updated_at
```

Two constraints make the cardinality work:

- `google_sheet_id` is **unique** — a sheet can be registered as a kosztorys
  exactly once (T1.3).
- A **partial unique index** `(investment_id) WHERE investment_id IS NOT NULL`
  enforces 1:1 between an investment and its kosztorys when linked, but allows
  unlimited unlinked rows.

`ON DELETE SET NULL` is intentional: deleting an investment **doesn't** delete
its kosztorys — the row stays as an unlinked kosztorys, the sheet survives, and
the owner can re-link it later. This is what lets a kosztorys outlive its
investment.

Why a separate collection (and not just a field on `investments`)? **So a
kosztorys can exist before its investment does.** The owner can register a
sheet at `/kosztorysy → "+ Dodaj kosztorys"`, cost the project, and link it to
an investment once the project is committed — see Provisioning below.

The migration trail is:

- `20260525_add_google_sheet_id_to_investments` — added the field on investments.
- `20260527_add_unique_google_sheet_id` — added the unique index.
- `20260528_move_sheet_id_to_kosztoryses` — created the new table, backfilled,
  dropped the column from investments. This is the source of truth today.

---

## The model — active-costs mirror (NOT append-only)

The sheet holds **only currently active (non-cancelled) expenses**:

- **Cancel → the row is deleted** from the sheet. There is **no** negative /
  reversing row. (The earlier append-only "double-entry" model is gone.)
- **Edit → the row is overwritten in place** (same row, same id, fresh field
  values). The type-change recolour happens automatically via the conditional
  format rule.
- The `RAZEM`/per-type totals therefore always equal the app's live totals.

## Sheet structure

- **Tab:** `wydatki inwestycyjne (tylko do odczytu)` — really protected, not just
  named so. `setupMaterialyTab` adds an `addProtectedRange` over the whole tab with
  `warningOnly: false` and `editors = [service account]`, so only the app can edit
  it. Idempotent: prior protected ranges are dropped and re-added on every
  setup/reset.
  **One inherent gap:** Google always lets the **file owner** bypass a protected
  range, so the owner (not other collaborators) can still hand-edit. Not closable
  without transferring sheet ownership to the service account.
- **Row 1: warning banner**, merged across the full table (A..K-ish, depending
  on type count), amber background, bold, frozen alongside the header.
  Text: "⚠ Edycje rób w aplikacji — ręczne zmiany w tej zakładce zostaną
  nadpisane przy następnej synchronizacji." Visible regardless of whether the
  owner views the iframe in-app or opens the sheet directly in a new tab. Reset
  re-writes it from scratch so it can't go stale.
- **Row 2: header. Row 3+: data**, with the summary totals also living on row 3
  (right of the data columns). The conditional-format anchor is `=$C3=<label>`.
- **Columns are header-driven, not positional.** `resolveHeaders` scans the top
  rows for a header carrying all seven fields and maps each to its column. The
  owner may reorder/add columns; the code still finds the right cells and
  **fails loud** if a header is missing or if a field keyword matches more than
  one column (review T2.7). The banner row's text doesn't match any field
  keyword, so the resolver skips past it.
  - Seven mapped fields: `id, data, typ, opis, kwota, kategoria, notatka`.
  - **Join key = the `id` column** (Postgres transaction id, stored as a number).
- **Summary block at column H (`SUMMARY_START_COL = 7`):**
  - **H2** = labels: `RAZEM` + one per expense type.
  - **H3** = totals: `=SUM(E:E)` and one `=SUMIF(C:C, "<type>", E:E)` per type
    — full-column ranges + literal type-name criteria → drift-proof against
    row inserts/sorts.
- **Row colour is a conditional-format rule**, not a static fill: a
  `CUSTOM_FORMULA` rule `=$C3=<label cell>` tints the whole row by the type in
  column C. Change the type → the row recolours automatically.
- **Google Sheets `Tables` are stripped on every setup/reset.** A Table (the
  `Data → Convert to table` feature, sometimes auto-applied by Sheets) claims a
  competing layout authority over the same range: it enforces column types
  (which silently override cell-level number formats — this was the root cause
  of T1.5's "typ kolumny liczba" warning on a namespaced id column), it
  hijacks row 1 as its column-name header (auto-filling missing cells with
  `Kolumna nr N`), and it disallows merged cells inside its range (which broke
  the banner merge on first attempt). The setup queries
  `sheets(tables(tableId))` and pushes `deleteTable` requests before applying
  formatting/protection, so the tab is always a single-authority surface owned
  by `setupMaterialyTab`. **The Table feature is therefore a known footgun**:
  if the file owner re-tables the tab manually, the next reset wipes the
  Table.

---

## Write paths

All sheet writes funnel through **one batched primitive**,
`applyMaterialRowsBatch(sheetId, upserts, removeIds)` (`src/lib/google/sheets.ts`):
one `readGrid` + at most one `values.batchUpdate` for upserts/appends and one
`batchUpdate` for column-scoped deletes (bottom-up so row numbers don't shift
mid-batch). Appends are written at an **explicitly computed row** (last
mapped-column data row + 1), not via Google `values.append` — that route was tried
and reverted because Sheets' table detection treats the adjacent summary column as
table content and would leave row 2 blank. `removeMaterialRow` is a thin wrapper
over the same primitive.

**Single-transfer mutations go through a Payload collection hook**
(`src/hooks/transfers/sync-kosztorys-sheet.ts`, wired in
`src/collections/transfers.ts`), so **admin-panel and bare-`payload.*` edits sync
too** (review T2.2). The hook lazy-imports the `'use server'` sync module inside
`after()` (avoids poisoning the collection's import graph) and defers via
`after()` so the mutation response isn't blocked on the Google API.

| Trigger                                  | How the sync fires                                                                                                | Sheet effect                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Create one expense (form, action)        | `payload.create` → `afterChange` hook → `after(syncSingleTransferToSheet)`                                        | Upsert one row (appends since the id isn't present).                                                    |
| **Bulk create**                          | Action sets `req.context.skipKosztorysSync = true` → per-row hook defers → `after(syncBulkExpensesToSheet)`       | **One batched call per investment** via `applyMaterialRowsBatch` (review T4.2, must-fix at 1000+ rows). |
| Edit expense (form, action, admin panel) | `payload.update` → `afterChange` hook → `after(syncSingleTransferToSheet)`                                        | Overwrites the 7 cells in place. If `investment` changed: drop from old sheet first, then sync to new.  |
| Cancel expense                           | `cancelTransferAction` flips `cancelled: true` on the original → `afterChange` hook → `syncSingleTransferToSheet` | Removes the original's row (cancelled/unmappable branch — review T2.4).                                 |
| Delete expense (admin panel)             | `afterDelete` hook → `after(removeTransferFromSheet)`                                                             | Row removed.                                                                                            |
| Reconcile (Synchronizuj button)          | `previewMaterialSync` → `applyMaterialSync` → `applyMaterialRowsBatch`                                            | One batched write: append missing + overwrite present (heal) + **scoped orphan-removal**.               |
| Reset tab (Zresetuj zakładkę)            | `setupKosztorysSheetAction` + `applyMaterialSync`                                                                 | Rebuilds the tab from scratch (header, summary, formatting) then re-syncs. **Wipes manual rows.**       |

Notes:

- **`after()`** (from `next/server`) runs the sync after the HTTP response yet keeps
  the serverless function alive to finish — so a slow Sheets API never blocks the
  user and the write isn't dropped on function return.
- **Scoped orphan-removal** only deletes sheet ids that resolve to **this
  investment's own `INVESTMENT_EXPENSE`** (review T1.1). A sheet id that resolves
  to some unrelated transaction (a payout, another investment's expense) or to no
  transaction at all (e.g. a hand-typed `99999`) is left in place.
- **Preview now matches apply.** `previewMaterialSync` returns `toAppend`,
  `toUpdateCount`, and `toRemoveCount` — built from the same `buildSyncPlan` the
  apply path uses (review T3.1). The button enables when any of those is non-zero.
- **Security.** `applyMaterialSync` re-derives the rows server-side; it never
  trusts the browser's `toAppend`. All sync/reset/link actions are gated to
  `ADMIN | OWNER | MANAGER`.

## Provisioning

Every kosztorys is one row in the `kosztoryses` collection (see Data model
above). There are three entry points, all of which boil down to one of two
sheet operations: **copy the template** (a new Drive file) or **link an
existing sheet** (an owner-shared file).

### Per-investment dialog (investment page banner / no-sheet table cell)

`KosztorysSetupDialog` offers two paths:

1. **Utwórz nowy kosztorys** — `provisionKosztorysAction` →
   `createKosztorysFromTemplate` ⇒ `drive.files.copy` from
   `KOSZTORYS_TEMPLATE_SHEET_ID`, then `payload.create('kosztoryses', ...)`
   with `investment: investmentId`. **Currently blocked on a personal-account
   service account**: the SA has no Drive storage quota and the copy fails
   with a "storage quota exceeded" error (`isStorageQuotaError`). The action
   detects this and surfaces a Polish-language message pointing the user at
   the link-existing path. `createInvestmentAction` also fire-and-forgets the
   same call on investment create, so a new investment lands without a
   kosztorys row and the no-sheet banner appears. The fix needs a Workspace
   Shared Drive + `supportsAllDrives` — see memory
   `project_kosztorys_sa_no_drive_storage`.
2. **Powiąż istniejący arkusz** — `linkKosztorysSheetAction`. The owner shares
   an already-existing sheet with the SA as Editor and pastes its URL/id.
   `verifySheetAccess` does a no-op write-probe to surface a Viewer-only share
   immediately, then the action creates a `kosztoryses` row with the sheet's
   title as `name` and the investment id set. **This is the working path
   today.** Guarded against re-registering an already-known sheet — the user
   is pointed at the listing page instead.

After either path creates the kosztoryses row, `setupKosztorysSheetAction`
attaches the read-only tab and stamps the banner + header + summary +
formatting.

### Listing page (unlinked workflow) — `/kosztorysy`

For costing a project **before** committing the investment:

3. **+ Dodaj kosztorys** (`AddKosztorysDialog`) →
   `addUnlinkedKosztorysAction`. Same paste-existing-URL flow as path 2, but
   creates a kosztoryses row with `investment IS NULL` and runs
   `setupMaterialyTab` so the sheet is pre-stamped (banner/header/summary).
   The row shows up in the "Niepowiązane kosztorysy" section.
4. **Powiąż z inwestycją** (per unlinked row) →
   `linkKosztorysToInvestmentAction(kosztorysId, investmentId)`. Sets
   `investment_id` on the existing kosztoryses row, then fire-and-forgets
   `applyMaterialSync` so the sheet inherits the investment's expenses. The
   picker only offers investments where `hasSheet=false` (derived from the
   `LEFT JOIN kosztoryses` in `fetchReferenceData`).

The listing page also surfaces the third axis — investments that don't yet
have a kosztorys — and reuses the existing `KosztorysSetupDialog` for those
rows (back to path 1/2).

---

## Failure modes — what we accept and what we don't

| Failure                                                                       | Behaviour                                                                                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Sheets API down on transfer create/edit/cancel                                | Hook's `after()` swallows the error (logged). Owner triggers the **Synchronizuj** button later — the reconciler heals the gap in one batch. |
| Service account loses access to a sheet                                       | Auto-push fails silently. Preview surfaces an error toast. Owner re-shares the sheet with the SA email as Editor.                           |
| Owner manually deletes an app-managed row                                     | Next reconcile sees the row as missing and **re-appends it**. The toast reports `+1 added`.                                                 |
| Owner manually edits an app-managed row                                       | Next reconcile **overwrites it back to the DB value** (`updated` in the toast). One-way sync, by design.                                    |
| Owner adds a manual row whose id matches an active expense in this investment | Update-side residual: the manual row is overwritten in place (review T1.5 — won't-fix, see below). Other manual ids are kept.               |
| Concurrent single-creates on the same sheet                                   | Two creates can compute the same append row and one will overwrite the other (review T2.1 — mitigated, see below). The reconciler heals it. |
| Concurrent rename of the tab                                                  | Sync fails with a header-not-found / range-parse error. Reset rebuilds the tab.                                                             |

What we **don't** accept:

- Silent corruption of human-typed columns. Writes only touch the 7 mapped cells,
  scoped row-deletes preserve the summary columns, and the conditional-format rule
  for row tinting is restored on every reset.
- Duplicate app-managed rows for the same transfer. Every upsert goes through the
  id → row map; a row already present is overwritten, never re-added.

---

## Accepted residuals

| ID   | What                                                                 | Why accepted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1.5 | Manual numeric in id column may collide with active expense id       | `#<id>` namespacing was attempted (`062c0ac`) and reverted (`09fb836`) because the sheet's wrapping **Table** enforced `columnType: DOUBLE` on column A. The 2026-05-28 banner work now strips Tables on every reset (see Sheet structure), so the _technical_ blocker is gone — namespacing would work today. The won't-fix is now decision-only: the residual is narrow (requires the file owner to bypass SA protection on the read-only tab and type a manual number that happens to equal one of THIS investment's active expense ids), and the reconciler's preview surfaces the planned overwrite before it lands. Revisit if a real case is ever reported. |
| T2.1 | Two concurrent single-creates can collide on the computed append row | One overwrites the other; the reconciler heals it on next click. Lost the server-side row-allocation guarantee because `values.append` couldn't be used (see write-paths note).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Full ledger of every finding, with status (☑ fixed · ⊘ won't-fix · accepted),
lives in `docs/plans/2026-05-27-kosztorys-pr13-simplify-review.md`.

## What we explicitly did NOT build (and why)

- **Outbox table.** Would give at-least-once delivery for sheet writes. The
  reconciler covers the same gap with no extra schema. Revisit if drift turns out
  to be common in real use.
- **Webhook from Sheets → app.** Two-way sync would mean reconciling sheet edits
  back into Postgres — a large scope expansion. Sheet is read-only from the app's
  perspective.
- **Scheduled / cron reconciler.** Considered as the backstop for swallowed sync
  errors and **rejected** (2026-05-28). The manual **Synchronizuj** button with
  its preview is the accepted backstop; sheets are low-traffic and an owner
  reconciles on demand.
- **Backfill for existing investments.** Old investments use the manual
  link-existing-sheet flow. Auto-provisioning isn't there because the SA can't
  own files on a personal-account Drive.
- **Server actions, NOT Payload hooks — REVERSED for sheet sync.** Project rule is
  still "side effects go in the server action", but kosztorys sync is the
  documented exception: it lives in the collection hook because admin-panel and
  bare-`payload.*` edits had to sync too (review T2.2). The bulk-create action
  sets `req.context.skipKosztorysSync` so the per-row hook defers to its batched
  call — no double work.

## Tests — live verification

Live tests on inv 6 (`1cFCFtplugpjJpq6xsABAdn7_pWBrji2V_E-9Kz33APs`) and inv 31
through the real UI via Playwright, reading the sheet back through the Sheets API.
Detailed log: `docs/plans/2026-05-27-kosztorys-active-costs-reconcile-plan.md`.

| Test                          | What it proves                                                  | Status                                      |
| ----------------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| A — Reset rebuilds clean      | sheet == DB active set; SUMIF totals reconcile                  | ✅ pass                                     |
| B — Cancel removes the row    | row gone, no negative row, summary survives                     | ✅ pass                                     |
| C — Create appends            | auto-sync on create; button is only a reconciler                | ✅ pass                                     |
| D — Edit updates in place     | same row, recolour, totals shift, no duplicate                  | ✅ pass                                     |
| E — Edit → move investment    | row moves old→new sheet (inv 6 → inv 31)                        | ✅ pass                                     |
| F — Manual-row preservation   | reconcile keeps `99999`, removes real orphans                   | ✅ pass                                     |
| G — Drift-proof sort          | SUMIF survives Data → sort-by-A (totals stay correct)           | ✅ pass (summary relocates — see open work) |
| T2.2 — Admin-panel edit syncs | edit at `/admin/collections/transactions/:id` reaches the sheet | ✅ pass (2026-05-28, inv 6)                 |

## Open work

- **Test-DB → production cutover** (the `⚠️ TEMPORARY` block in `CLAUDE.md`):
  - [ ] Flip `DB_POSTGRES_URL` back from `wykonczymy-test-db` to `wykonczymy-db`.
  - [ ] Apply the three sheets-id migrations to `wykonczymy-db`:
        `20260525_add_google_sheet_id_to_investments`,
        `20260527_add_unique_google_sheet_id`, and
        `20260528_move_sheet_id_to_kosztoryses` (the prior two run, then this
        one creates kosztoryses + drops the column; backfill is a no-op since
        prod has no kosztoryses yet).
  - [ ] Drop `wykonczymy-test-db`.
  - [ ] Remove the temporary section from `CLAUDE.md`.
- **Vercel env vars for Production** — `env.ts` `process.exit(1)`s on missing
  vars, so before promoting prod: add `GOOGLE_SERVICE_ACCOUNT_JSON` and
  `KOSZTORYS_TEMPLATE_SHEET_ID` (`KOSZTORYS_DRIVE_FOLDER_ID` optional).
- **Vercel env vars for all Preview** — currently scoped to the `staging` branch;
  other preview branches won't boot until vars are broadened (do via dashboard).
- **Summary block relocates on Data → sort-by-A** — cosmetic; numbers stay
  correct, a reset re-pins it. Decide whether to pin the summary or leave it.
- **Banner CTA simplification** — both "Powiąż istniejący" and "Utwórz nowy"
  ship; drop the unused one after owners actually try them.

## Key files

```
src/collections/kosztoryses.ts                    ← the collection itself (sheet id + optional FK to investment)
src/lib/google/sheets.ts                          ← header-driven read/applyMaterialRowsBatch/setup/protection/summary/colour
src/lib/google/sheet-access.ts                    ← link/verify an existing sheet (extractSheetId, verifySheetAccess)
src/lib/google/auth.ts                            ← service-account JWT factory
src/lib/google/kosztorys-lookup.ts                ← getInvestmentSheetId(payload, id) — the shared kosztoryses → sheetId helper
src/hooks/transfers/sync-kosztorys-sheet.ts       ← collection-hook side of the sync (the T2.2 path)
src/lib/actions/sheets-sync.ts                    ← preview / apply (server re-derive) / syncSingleTransferToSheet / syncBulkExpensesToSheet / removeTransferFromSheet
src/lib/actions/transfers.ts                      ← bulk action: sets skipKosztorysSync + after(syncBulkExpensesToSheet)
src/lib/actions/investments.ts                    ← per-investment link/provision/setup actions
src/lib/actions/kosztoryses.ts                    ← unlinked add / link-to-investment / unlink / delete actions
src/lib/queries/kosztoryses.ts                    ← cached listing query (fetchAllKosztoryses)
src/lib/queries/reference-data.ts                 ← investments LEFT JOIN kosztoryses → hasSheet
src/collections/transfers.ts                      ← afterChange/afterDelete wire syncKosztorys* alongside the balance recalc
src/migrations/20260528_move_sheet_id_to_kosztoryses.ts  ← the schema split
src/app/(frontend)/kosztorysy/page.tsx            ← top-level listing (3 sections + Add CTA)
src/app/(frontend)/inwestycje/[id]/kosztorys/     ← per-investment page, iframe-view, sync-button (reset + sync dialogs)
src/components/dialogs/kosztorys-setup-dialog.tsx       ← per-investment dialog (template + link tabs)
src/components/dialogs/add-kosztorys-dialog.tsx         ← listing-page CTA dialog (unlinked add)
src/components/dialogs/link-kosztorys-to-investment-dialog.tsx  ← per-row CTA dialog
src/__tests__/lib/google/sheets.test.ts
src/__tests__/lib/actions/sheets-sync.test.ts
src/__tests__/hooks/sync-kosztorys-sheet.test.ts
```
