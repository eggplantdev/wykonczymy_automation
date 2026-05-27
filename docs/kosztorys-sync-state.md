# Kosztorys ↔ Google Sheets — Current State (consolidated)

> **Status: 2026-05-27.** This is the single source of truth for how the
> kosztorys↔sheet sync behaves **right now**. It consolidates and supersedes the
> behavioural parts of:
>
> - `docs/kosztorys-sync-architecture.md` (rationale; its append-only / negative-row
>   prose is **stale** — see "the model" below)
> - `docs/plans/2026-05-27-kosztorys-active-costs-reconcile-*.md` (the redesign that
>   landed; its "Live verification log" is the test record this doc summarises)
>
> Keep those for history. Edit **this** doc when behaviour changes.

---

## One-paragraph summary

Postgres is the source of truth; the Google Sheet is a **materialised view** (a
read model in CQRS terms). The app owns one tab —
`wydatki inwestycyjne (tylko do odczytu)` — and mirrors into it **every
non-cancelled `INVESTMENT_EXPENSE`** for the investment, one row per transaction,
keyed by the Postgres `id`. Everything else on the sheet (other tabs, owner
columns, manual rows) is "sheet land" the app never touches. Writes are pushed
automatically on create/cancel/edit (post-response), and a manual **Synchronizuj**
button reconciles drift.

---

## The sheet's current structure

- **Tab:** `wydatki inwestycyjne (tylko do odczytu)` — **really protected**, not
  just named so. `setupMaterialyTab` adds an `addProtectedRange` over the whole
  tab with `warningOnly: false` and `editors = [service account]`, so only the app
  can edit it. Idempotent: prior protected ranges are dropped and re-added on every
  setup/reset. **One inherent gap:** Google always lets the **file owner** bypass a
  protected range, so the owner (not other collaborators) can still hand-edit. That
  can't be closed without transferring sheet ownership to the service account.
- **Columns are header-driven, not positional.** `resolveHeaders` scans the top
  rows for a header carrying all seven fields and maps each to its column. The
  owner may reorder/add columns; the code still finds the right cells, and
  **fails loud** if a required header is missing.
  - Seven mapped fields: `id, data, typ, opis, kwota, kategoria, notatka`.
  - **Join key = the `id` column** (holds the Postgres transaction id). Nothing
    else identifies a row.
- **Summary block at column H (`SUMMARY_START_COL = 7`):**
  - **H1** = labels: `RAZEM` + one per expense type.
  - **H2** = totals: `=SUM(E:E)` and one `=SUMIF(C:C, "<type>", E:E)` per type.
  - Uses **full-column ranges + literal type-name criteria** → drift-proof: row
    inserts/sorts can't unstick the formula or zero a total.
- **Row colour is a conditional-format rule**, not a static fill: a
  `CUSTOM_FORMULA` rule `=$C2=<label cell>` tints the whole row by the type in
  column C. Change the type → the row recolours automatically.

## The model — active-costs mirror (NOT append-only)

The sheet holds **only the currently active (non-cancelled) expenses**:

- **Cancel → the row is deleted** from the sheet. There is **no** negative /
  reversing row. (The old append-only "double-entry" model is gone.)
- The `RAZEM`/per-type totals therefore always equal the app's live totals.

## Write paths

All sheet writes go through **one batched path**, `applyMaterialRowsBatch(sheetId, upserts, removeIds)`
(`sheets.ts`): it upserts by id (append new rows via Google `values.append`, overwrite present
rows in place) and removes ids in a single round of API calls. Appends land from **row 3** (row 2
is the summary row). `removeMaterialRow` is a thin wrapper that delegates to the same batched path.

| Trigger                           | Action                                                                                   | Sheet effect                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Create expense                    | `createTransferAction` / `createBulkTransferAction` → `after(syncSingleTransferToSheet)` | `applyMaterialRowsBatch` upsert of one row → **appends** it. Bulk = one call per row in the `after()` loop.                             |
| Cancel expense                    | `cancelTransferAction` → `after(syncSingleTransferToSheet(cancellation.id))`             | **Removes** the original's row (`removeMaterialRow` → batched scoped delete).                                                           |
| Edit expense                      | `syncSingleTransferToSheet` → `applyMaterialRowsBatch` upsert (by id)                    | **Overwrites the 7 cells in place** (same row, no duplicate). Type change recolours via the conditional rule; totals shift via SUMIF.   |
| Edit → move to another investment | `removeTransferFromSheet` (old sheet) + `syncSingleTransferToSheet` (new sheet)          | Row dropped from old sheet, appended to new.                                                                                            |
| Reconcile (Synchronizuj button)   | `previewMaterialSync` → `applyMaterialSync` → `applyMaterialRowsBatch`                   | One batched write: **append** missing + **overwrite** present (heal) + **scoped orphan-removal**. Reports `+added / updated / removed`. |
| Reset tab (Zresetuj zakładkę)     | `setupKosztorysSheetAction` + `applyMaterialSync`                                        | Rebuilds the tab from scratch (header, summary, formatting) then re-syncs via the batched write. **Wipes manual rows** — destructive.   |

Notes:

- **`after()`** (from `next/server`) runs the sync after the HTTP response yet keeps
  the serverless function alive to finish — so a slow Sheets API never blocks the
  user and the write isn't dropped on function return.
- **Scoped orphan-removal** only deletes sheet ids that resolve to a **real
  transaction** (cancelled / moved / deleted). A sheet id that isn't a
  transaction (e.g. a hand-typed `99999`) is the owner's manual row — **kept**.
- **Preview understates apply.** `previewMaterialSync` shows only `toAppend`
  (new rows). `applyMaterialSync` additionally overwrites present rows and removes
  orphans — the post-run toast reports the real `added/updated/removed`.
- **Security:** `applyMaterialSync` re-derives the rows server-side; it never
  trusts the browser's `toAppend`. All sync/reset/provision actions are gated to
  `ADMIN | OWNER | MANAGER`.

## Provisioning

An investment links to a sheet via `investments.googleSheetId`. We **link an
owner-shared existing sheet** (the service account has no Drive storage quota on a
personal account) rather than copying a template. Setup attaches/rebuilds the
read-only tab.

## Recent fixes

- **Single batched write path (`7fc8ec0`).** All sheet writes now funnel through
  `applyMaterialRowsBatch` (upsert + scoped remove in one round) instead of serial
  per-row `appendMaterialRow`/`updateMaterialRow` calls. This fixes the failure where
  reconciling/resetting a large investment (e.g. inv 31, ~94 expenses) blew Google's
  ~60 writes/min quota and silently dropped rows. Side effect: data now starts at
  **row 3** (Google `values.append` places rows after the summary on row 2). Also
  landed alongside: scoped orphan-removal guard (`d826ed1`), dropped 1000-row caps
  that could orphan-delete real rows (`5e3b711`), and a unique constraint on
  `googleSheetId` so one sheet can't link to two investments (`4459b6f`/`8752064`).
- **`removeMaterialRow` column-scoped delete (`53b8727`).** Was a full-width
  `deleteDimension: ROWS`; because the newest expense and the H2 summary totals shared
  row 2, deleting the top expense wiped the `=SUM`/`=SUMIF` formulas. Now a
  column-scoped `deleteRange` (`shiftDimension: ROWS`, columns `[0, SUMMARY_START_COL)`)
  removes only the data cells, leaving the summary columns untouched. (With data now on
  row 3+, the summary on row 2 is decoupled regardless.) Verified live + unit-tested.

## Verification status (live, investment 6)

Detailed log: `docs/plans/2026-05-27-kosztorys-active-costs-reconcile-plan.md`.

| Test                        | What it proves                                        | Status                            |
| --------------------------- | ----------------------------------------------------- | --------------------------------- |
| A — Reset rebuilds clean    | sheet == DB active set; SUMIF totals reconcile        | ✅ pass                           |
| B — Cancel removes the row  | row gone, no negative row, summary survives (the fix) | ✅ pass                           |
| C — Create appends          | auto-sync on create; button is only a reconciler      | ✅ pass                           |
| D — Edit updates in place   | same row, recolour, totals shift, no duplicate        | ✅ pass                           |
| E — Edit → move investment  | row moves old→new sheet (inv6 → inv31)                | ✅ pass                           |
| F — Manual-row preservation | reconcile keeps `99999`, removes real orphans         | ✅ pass                           |
| G — Drift-proof sort        | SUMIF survives Data → sort-by-A (totals stay correct) | ✅ pass (summary relocates — #19) |

All of A–G pass. G also reproduced cosmetic **finding #19**: after a sort, the summary
block relocates off row 2 (numbers stay correct; a reset re-pins it).

---

## Things still left

**Live verification:** ✅ **Done — A–G all pass** (2026-05-27, inv 6 + inv 31). See the
verification log in `docs/plans/2026-05-27-kosztorys-active-costs-reconcile-plan.md`.
One follow-up surfaced: cosmetic **finding #19** (summary block relocates off row 2 after a
sort/large row-shift; numbers stay correct, a reset re-pins it) — decide whether to pin the
summary block or leave it.

**Staging/prod deployment prerequisites (env vars):** `env.ts` validates at boot and
`process.exit(1)`s if missing, so the feature needs two new vars per environment:
`GOOGLE_SERVICE_ACCOUNT_JSON` (sensitive) + `KOSZTORYS_TEMPLATE_SHEET_ID`
(`KOSZTORYS_DRIVE_FOLDER_ID` optional, unset).

- [x] **Preview / `staging` branch** — both added 2026-05-27 (scoped to the `staging`
      git branch; the Vercel project has no custom env, so the `staging` branch deploys
      under Preview). Verified via `vercel env ls preview`.
- [ ] **Production** — not set yet (deferred); add before promoting prod, else prod
      crashes on the `env.ts` boot check.
- [ ] **Broaden Preview** — vars are scoped to the `staging` branch only. Other preview
      branches (incl. `table`) won't boot until the vars are added to all Preview (do via
      dashboard or interactively; 54.1.0's non-interactive CLI won't target all-Preview).

**Test-DB → production cutover (the `⚠️ TEMPORARY` block in `CLAUDE.md`):**

- [ ] Flip `DB_POSTGRES_URL` back from `wykonczymy-test-db` to `wykonczymy-db`.
- [ ] Apply migration `20260525_add_google_sheet_id_to_investments` to the real
      `wykonczymy-db` (currently only on the test DB).
- [ ] Drop `wykonczymy-test-db`.
- [ ] Remove the temporary section from `CLAUDE.md`.

**Deferred features (gated on the owner trial):**

- [x] **Materiały tab protection** — DONE. `setupMaterialyTab` hard-protects the
      whole tab (`addProtectedRange`, service account as sole editor). Only residual
      is the inherent owner-bypass (not worth transferring sheet ownership to fix).
- [ ] **Backfill** existing investments with sheets — today only _new_ investments
      auto-provision; old ones use the banner's manual link.
- [ ] **Banner CTA simplification** — both "Powiąż istniejący" and "Utwórz nowy"
      shipped; drop the unused one after the trial.
- [ ] **Orphan UX** — a "convert orphan to transfer" affordance if orphans pile up.
- [ ] **Sheets → app webhook** — only if owners repeatedly expect sheet edits to
      flow back into the app (large scope; currently one-way).
- [ ] **Outbox table** — only if the trial shows drift is common.

**Doc / housekeeping:**

- [ ] Reconcile or retire `docs/kosztorys-sync-architecture.md`'s stale
      append-only prose (this doc supersedes the behavioural parts).
- [ ] Clean up leftover test data from the A–G runs: **#2469** ("Test D") active on inv 6,
      **#2470** ("Test E") active on inv 31 (both mirrored on their sheets); cancelled test rows
      (#2461/#2462/#2463/#2467) remain in Postgres with their CANCELLATION audit rows. A sheet
      **reset** per investment rebuilds clean tabs.

**Open product question:**

- [ ] One-week owner trial gates the deferred items above — don't change
      `sheets.ts` / `drive.ts` / `sheets-sync.ts` / auto-push wiring mid-trial.
- [ ] **Does the owner use manual rows on the read-only tab?** (Parked 2026-05-27.)
      Decides two things: (a) how costly **reset** really is — reset wipes manual
      rows, the only sheet content not reconstructable from Postgres; (b) whether
      tab protection should stay **whole-tab** or be scoped to just the app columns
      so collaborators can add their own rows. If the owner never adds manual rows,
      this tab is fully disposable and no further work is warranted.

---

## Key files

```
src/lib/google/sheets.ts            ← header-driven read/append/update/removeMaterialRow, summary, conditional colour
src/lib/google/auth.ts              ← service-account JWT
src/lib/google/sheet-access.ts      ← link/verify an existing sheet
src/lib/actions/sheets-sync.ts      ← preview / apply (server re-derive) / syncSingleTransferToSheet / removeTransferFromSheet
src/lib/actions/transfers.ts        ← after() sync on create / bulk-create / cancel
src/lib/actions/investments.ts      ← link & setup/reset kosztorys sheet actions
src/collections/investments.ts      ← googleSheetId field
src/app/(frontend)/inwestycje/[id]/kosztorys/   ← page, iframe-view, sync-button (reset + sync dialogs)
src/__tests__/lib/google/sheets.test.ts
src/__tests__/lib/actions/sheets-sync.test.ts
```
