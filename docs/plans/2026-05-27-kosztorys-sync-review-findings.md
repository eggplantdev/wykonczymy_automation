# Kosztorys Sync — Code Review Findings (2026-05-27)

> Extra-high-effort review of the header-driven Google Sheets sync (branch
> `table`). Each item: **problem** (short) → **fix** (proposed). Fix order:
> **1, 2, 3, 5, 6** first (data-loss + security + correctness), then the rest.
>
> **Status (2026-05-27):** #1, #2, #3, #5, #6 implemented. Remaining: #4, #7–#15.

## High severity

**1. Concurrent append race → data loss** — `src/lib/google/sheets.ts` (`appendMaterialRow`, ~L178)

- Problem: reads the grid, computes "next empty row," then writes. `createBulkTransferAction` fires N `void syncSingleTransferToSheet` at once → all compute the same row → last write wins, others silently lost.
- Fix: use atomic `spreadsheets.values.append` (server assigns the row) instead of read-then-write; or `await` the bulk loop sequentially.
- **Done:** serialized the bulk loop in `createBulkTransferAction` (await per row inside one `after()` callback) — kept the header-driven explicit-cell write rather than positional `append`. Residual: two _separate_ concurrent invocations (e.g. a manual sync overlapping a create) could still collide; acceptable at this app's scale, revisit with a row lock if it bites.

**2. Link verifies read-only scope → later sync 403** — `src/lib/google/sheet-access.ts:26` (`verifySheetAccess`)

- Problem: authenticates with `spreadsheets.readonly`, so a Viewer-only share passes linking, but `setupMaterialyTab`/`appendMaterialRow` (write scope) 403 on first sync.
- Fix: verify with the write scope (`spreadsheets`) or a no-op write probe, so a non-Editor share fails at link time.

**3. `applyMaterialSync` trusts the client preview (forgeable)** — `src/lib/actions/sheets-sync.ts` (~L185)

- Problem: appends `preview.toAppend` (round-tripped through the browser) verbatim; only dedups by `transferId`. A MANAGEMENT user can inject arbitrary typ/amount/description.
- Fix: ignore incoming rows; re-derive `toAppend` server-side via `loadAppMaterialRows`. Keep preview display-only.

**4. Edits never reach the sheet (silent, unrecoverable drift)** — `src/lib/actions/sheets-sync.ts` (~L169) + `transfers.ts` `updateTransferAction`

- Problem: preview is append-only (`!sheetIds.has(id)`) and update never syncs → an edited already-synced row can never be corrected, even by manual re-sync.
- Fix: on update of a synced expense, clear+re-append that row; or surface a "needs re-sync" flag; cheapest: block editing synced fields / document loudly.

**5. Fire-and-forget sync dropped on serverless** — `src/lib/actions/transfers.ts:71,155,242`

- Problem: `void syncSingleTransferToSheet(...)` can be frozen/killed when the action returns on Vercel → row silently never lands.
- Fix: use Next.js `after()` (`next/server`) so the work runs post-response but is awaited by the runtime; or enqueue it (Vercel Queues).

**6. `isoDate` off-by-one (UTC shift)** — `src/lib/actions/sheets-sync.ts:40`

- Problem: `new Date(d).toISOString().slice(0,10)` converts to UTC → date can land a day early (e.g. just-after-midnight Europe/Warsaw). Cancellation date computed in UTC too.
- Fix: format in the app timezone, or slice the stored `YYYY-MM-DD` string directly without a `Date` round-trip.

**7. Cancelled expense with no CANCELLATION row → overstated spend** — `src/lib/actions/sheets-sync.ts` (`loadAppMaterialRows`, ~L104)

- Problem: `+` rows now include cancelled expenses, assuming a matching `−` row always exists. A `cancelled=true` set via admin/legacy path (no CANCELLATION tx) syncs a lone `+`.
- Fix: skip the `+` row for a cancelled expense that has no matching CANCELLATION (or re-add a `cancelled` guard and only emit cancellations that exist).

**8. SUMIF `;` separator breaks on non-PL linked sheets** — `src/lib/google/sheets.ts` (~L271)

- Problem: hardcoded `;` is correct for Polish-locale sheets (verified) but errors on a `,`-locale linked sheet.
- Fix: read `spreadsheetProperties.locale` and choose `,`/`;`; or normalize the sheet locale to `pl_PL` on setup.

## Lower severity

**9. Per-type SUMIF vs RAZEM mismatch** — `src/lib/google/sheets.ts` (~L268)

- Problem: a synced category with no summary column counts in `RAZEM=SUM(E:E)` but in no per-type SUMIF (e.g. a category added after setup) → per-type totals don't reconcile to RAZEM.
- Fix: build a SUMIF column for every current type at sync time, or use a dynamic `QUERY` summary.

**10. Reset toast hides per-row append errors** — `src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx:44`

- Problem: `onSetupConfirm` shows green "+N" even when `applied.data.errors` is non-empty (errors swallowed). The manual `onConfirm` path does show them.
- Fix: include `errors.length` in the reset-path toast, same as the sync path.

**11. `Number(amount)` can write NaN/0** — `src/lib/actions/sheets-sync.ts` (~L61)

- Problem: `Number('')→0` (silent wrong) / `Number('x')→NaN` (serialized as text); no `isFinite` guard before append.
- Fix: guard `Number.isFinite(amount)` and skip/log otherwise.

**12. Protected range locks out human collaborators on a linked sheet** — `src/lib/google/sheets.ts` (~L445)

- Problem: whole-tab protected range with editors=[SA] removes edit from the owner's other collaborators (owner kept by Google).
- Fix: scope the protection (or use `warningOnly`) and/or warn the owner that collaborators lose edit on the tab.

**13. Link doesn't confirm the tab exists** — `src/lib/google/sheet-access.ts:31`

- Problem: `verifySheetAccess` only confirms the SA can open the file; linking "succeeds" on any accessible spreadsheet, then sync errors "Arkusz nie ma karty…".
- Fix: also check for the tab (or offer to create it) during link.

**14. `applyMaterialSync` revalidates the wrong cache tag** — `src/lib/actions/sheets-sync.ts` (~L216)

- Problem: revalidates `transfers`, not `investments`; sheet-derived investment/kosztorys UI can stay stale.
- Fix: revalidate `CACHE_TAGS.investments` (the mutated resource).

**15. Brittle Drive quota-error detection** — `src/lib/actions/investments.ts` (~L100)

- Problem: relies on a substring match of Google's localizable, non-contractual error text.
- Fix: match by error code/reason, not message text.

## UI / layout / forms — follow-up review TODO (2026-05-27)

> From the review of the kosztorys nav/listing, full-height iframe, refresh
> button, and the invoice file-input fix. Not yet implemented.

- [ ] **16. Mobile: kosztorys iframe clipped by the footer** — `src/app/(frontend)/inwestycje/[id]/kosztorys/iframe-view.tsx` (~L15)
  - Problem: container is `h-[calc(100dvh-3.5rem)]`, subtracting only the top nav. `AppFooter` is `lg:hidden` (visible below `lg`), so on phone/tablet the iframe is taller than the space left after topnav + footer → the spreadsheet bottom is clipped / `main` scrolls. Desktop hides the footer, masking it.
  - Fix: account for the footer height on `< lg` (e.g. a `lg:` variant on the height calc, or make the iframe fill `main` via flex instead of a viewport calc).

- [ ] **17. Transfer-type switch leaks a queued invoice file** — `src/components/forms/expense-form/expense-form.tsx` (`resetConditionalFields`, ~L184)
  - Problem: on type change it calls `form.resetField('lineItems')` but does not call `resetInvoiceFiles()` or bump `fileInputKey`. The `invoiceFilesRef` entry and the native file input survive, so a file queued before the switch can attach to the wrong/nonexistent line item on submit.
  - Fix: also call `resetInvoiceFiles()` and `setFileInputKey((k) => k + 1)` inside `resetConditionalFields`.

- [ ] **18. Mid-list line-item removal desyncs the file label** — `src/components/forms/form-fields/line-items-field.tsx` (~L196)
  - Problem: FileInput is keyed by array index (`file-${fileInputKey}-${index}`). Removing a middle line item reindexes the `invoiceFilesRef` map correctly but remounts the shifted rows' inputs, clearing their displayed filename while a file is still queued — UI shows "no file" for a row that has one. Pre-existing index-keying weakness; the full-reset fix is correct, this path is not covered.
  - Fix: key file inputs by a stable line-item identity instead of array index (requires line items to carry an id), or accept the cosmetic desync.

> Note: a flagged concern that the "Odśwież dane" button (`revalidatePath('/', 'layout')`) might not invalidate `unstable_cache` data was **investigated and refuted** — a controlled test (DB-only change → stale on reload → fresh only after the button) confirmed it does refresh the reference-data cache. No action needed.
