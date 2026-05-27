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

| Trigger                           | Action                                                                                   | Sheet effect                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Create expense                    | `createTransferAction` / `createBulkTransferAction` → `after(syncSingleTransferToSheet)` | **Append** at the next empty row (bottom). Bulk creates run after commit, serialized.                                                |
| Cancel expense                    | `cancelTransferAction` → `after(syncSingleTransferToSheet(cancellation.id))`             | **Remove** the original's row (`removeMaterialRow`).                                                                                 |
| Edit expense                      | `syncSingleTransferToSheet` → `updateMaterialRow` (by id)                                | **Overwrite the 7 cells in place** (same row, no duplicate). Type change recolours via the conditional rule; totals shift via SUMIF. |
| Edit → move to another investment | `removeTransferFromSheet` (old sheet) + `syncSingleTransferToSheet` (new sheet)          | Row dropped from old sheet, appended to new.                                                                                         |
| Reconcile (Synchronizuj button)   | `previewMaterialSync` → `applyMaterialSync`                                              | **Append** missing + **overwrite** present (heal) + **scoped orphan-removal**. Reports `+added / updated / removed`.                 |
| Reset tab (Zresetuj zakładkę)     | `setupKosztorysSheetAction` + `applyMaterialSync`                                        | Rebuilds the tab from scratch (header, summary, formatting) then re-syncs. **Wipes manual rows** — destructive.                      |

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

## Recent fix (committed `53b8727`)

`removeMaterialRow` used a full-width `deleteDimension: ROWS`. Because the newest
expense and the H2 summary totals share **row 2**, deleting the top expense wiped
the `=SUM`/`=SUMIF` formulas. Fixed to a column-scoped `deleteRange`
(`shiftDimension: ROWS`, columns `[0, SUMMARY_START_COL)`): only the data cells are
removed and rows below shift up, leaving the summary columns untouched. Verified
live + unit-tested.

## Verification status (live, investment 6)

Detailed log: `docs/plans/2026-05-27-kosztorys-active-costs-reconcile-plan.md`.

| Test                        | What it proves                                        | Status                              |
| --------------------------- | ----------------------------------------------------- | ----------------------------------- |
| A — Reset rebuilds clean    | sheet == DB active set; SUMIF totals reconcile        | ✅ pass                             |
| B — Cancel removes the row  | row gone, no negative row, summary survives (the fix) | ✅ pass                             |
| C — Create appends          | auto-sync on create; button is only a reconciler      | ✅ pass                             |
| D — Edit updates in place   | same row, recolour, totals shift, no duplicate        | ✅ pass                             |
| E — Edit → move investment  | row moves old→new sheet                               | ⛔ not run (needs 2nd linked sheet) |
| F — Manual-row preservation | reconcile keeps `99999`, removes real orphans         | ⚠️ code-confirmed, not live         |
| G — Drift-proof sort        | SUMIF survives Data → sort-by-A                       | ⚠️ not run as the exact action      |

---

## Things still left

**Live verification (remaining):**

- [ ] **Test E — Edit → move investment.** Needs a second investment that has a
      linked `googleSheetId`. Verify the row leaves the old sheet and appears on the new.
- [ ] **Test F — Manual-row preservation.** Type a row with id `99999` into the
      sheet, run **Synchronizuj** → confirm `99999` survives while real-transaction
      orphans are removed.
- [ ] **Test G — Drift-proof formula.** In the sheet, Data → sort by column A;
      confirm per-type SUMIF totals stay correct (don't drop to 0).

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
- [ ] Clean up leftover test data: expense **#2469** ("Test D — po edycji") is still
      active on inv 6 and mirrored on the sheet. The cancelled test rows
      (#2461/#2462/#2463/#2467) remain in Postgres with their CANCELLATION audit rows.

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
