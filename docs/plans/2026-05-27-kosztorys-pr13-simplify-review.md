# Kosztorys PR #13 — `simplify` review findings

> Review of `git diff origin/staging...table` (PR #13, `table` → `staging`): the kosztorys ↔ Google
> Sheets integration. 57 files / ~7,600 insertions. Run at xhigh effort: 9 finder angles × ≤8
> candidates → clustered verification → gap sweep. All subagents on opus.
>
> **Status legend:** ☐ open · ☑ fixed · ⊘ won't-fix (by design) · ⚠ needs decision
>
> Findings are tiered by severity. Tier 1 = silent data loss / corruption (fix before merge to
> staging-then-main). Tiers 2–3 = consistency/UX holes. Tier 4–5 = cleanup & architecture.
> Each finding was CONFIRMED against the live code unless marked PLAUSIBLE.
>
> **SCALE DECISION (2026-05-27):** the user confirmed a single kosztorys can hold **1000+ expense
> rows**. This elevates **T2.1 + T4.1 (batch the reconcile) to MUST-FIX** — at that scale the
> full-reconcile button does O(N) Google API calls and would rate-limit / fail mid-sync. They are
> the same refactor (read grid once → single `values.batchUpdate`). See `project_kosztorys_scale_1000plus` memory.

---

## Tier 1 — Silent data loss / corruption (must-fix)

### T1.1 ☑ Orphan-removal query is not scoped to type or investment

**`src/lib/actions/sheets-sync.ts:213`** — CONFIRMED → **FIXED**: guard query now scoped to `id ∈ orphans AND investment = investmentId AND type = INVESTMENT_EXPENSE`, so only this investment's own (cancelled) expense rows are removable; a manual number colliding with an unrelated transaction is kept. Tests added: scoped-where assertion + keep-on-collision behavior.

`applyMaterialSync` decides which sheet rows are "real" by `payload.find({ collection:'transactions', where: { id: { in: orphanIds } } })` with **no** `type` or `investment` filter (contrast `loadAppMaterialRows`, which scopes by investment + type + not-cancelled). Any id that resolves to _any_ transaction — a `PAYOUT`, a deposit, an expense from a _different_ investment — passes the "real transaction" gate, so `removeMaterialRow` deletes the row.

**Trigger:** owner types a value into the id-cell of a manual row that happens to equal a real transaction id → that manual row is silently deleted on the next Synchronizuj. The exact rows the code claims to protect.
**Fix:** scope the guard query to `type: { equals: 'INVESTMENT_EXPENSE' }` AND `investment: { equals: investmentId }`, so only ids that are _this investment's expenses_ count as removable.

### T1.2 ☑ `>1000` active expenses → valid synced rows deleted as "orphans"

**`src/lib/actions/sheets-sync.ts:104` + `src/lib/google/sheets.ts:21` (`A1:Z1000` cap)** — CONFIRMED → **FIXED**: `TAB_RANGE` is now open-ended `A:Z` (no row cap; Google trims trailing empties), and both `payload.find` caps (`loadAppMaterialRows` + orphan guard) are `limit: 0` (all docs). Reads no longer truncate, so no real row is ever mistaken for an orphan. (Columns past `Z` remain unsupported — acceptable: data is A–G, summary starts at H.) Test added: open-range + uncapped-find assertion.

`loadAppMaterialRows` caps at `limit: 1000` and the sheet read range is hard-capped `A1:Z1000`. For an investment with >1000 active `INVESTMENT_EXPENSE` rows, expenses 1001+ are excluded from `appRows`. `applyMaterialSync` then sees their already-synced sheet rows as orphans; the orphan check (T1.1) finds they _are_ real transactions and removes them.

**Trigger:** any kosztorys that grows past 1000 expense rows. Also: columns past `Z` are invisible to header resolution; appends recompute "last id row" only within the first 1000 rows and overwrite/duplicate.
**Fix:** raise/remove the row cap (paginate `loadAppMaterialRows`; widen/auto-size `TAB_RANGE`), and make orphan-removal correct under truncation (don't delete an id you didn't fully enumerate). Couple with T1.1.

### T1.3 ☑ No unique constraint on `google_sheet_id` → two investments can share one sheet

**`src/collections/investments.ts` + `src/migrations/20260527_add_unique_google_sheet_id.ts`** — CONFIRMED → **FIXED (both layers)**
**Layer 1 (app guard):** `linkKosztorysSheetAction` rejects a sheet already linked to another investment (names the conflict), before the Google round-trip.
**Layer 2 (DB unique index):** `unique: true` on the field + hand-written `CREATE UNIQUE INDEX investments_google_sheet_id_idx` migration, applied to test-db. Verified: NULLs allowed (unlinked investments fine), duplicate non-null rejected. Catches direct admin-panel edits too.

> **Migration tooling note (pre-existing debt, NOT this PR):** `migrate:create` could not generate this — it emits phantom drift because `.json` schema snapshots are missing for the 6 hand-written migrations since `20260312`, so its baseline is frozen at the Feb snapshot. The index migration was hand-written (mirroring `20260525_add_google_sheet_id`), consistent with those 6. Rebuilding the snapshot baseline is separate deferred tech debt — see `project_migrate_create_stale_snapshots` memory. Runtime is unaffected; only the generator is broken.

The column/field has no unique constraint. Two investments can be linked to the same spreadsheet (paste the same URL, or admin edit).

**Trigger:** same sheet linked twice → both sync disjoint expense sets into one tab; each `applyMaterialSync` sees the _other_ investment's rows as real-transaction orphans (made worse if T1.1 is fixed only for type, not investment) and deletes them → the two investments continuously erase each other.
**Fix:** add a unique index on `google_sheet_id` (Payload field `unique: true` + migration), and reject linking an already-linked sheet in `linkKosztorysSheetAction`.

### T1.4 ☑ `appendMaterialRow` overwrites a manual row directly below the data block

**`src/lib/google/sheets.ts`** — CONFIRMED → **FIXED (live-verified)**: the append target is computed as the row after the last non-empty cell in the MAPPED columns (A–G) — scanning all mapped columns (not just the id column) means a manual row below the block pushes appends past it. (NB: `values.append` was tried first but its table detection counts the adjacent summary column and mis-places the row — see T2.1.) Verified on inv 6: 36-row resync left no blank/overwritten row.

Append target = `(last row with a parseable id) + 1`. A manual non-id row sitting immediately below the data block does not advance `lastDataRow`, so the next append writes its 7 mapped cells over that manual row (no empty-cell guard, `USER_ENTERED`).

**Trigger:** owner adds a "Notes" row directly under the synced expenses → next expense create overwrites it.
**Fix:** append below the last _non-empty_ row, or require an explicit blank separator the append never crosses.

### T1.5 ◐ Any finite number in the id column is treated as a transferId

**`src/lib/google/sheets.ts:179`** — CONFIRMED → **PARTIALLY FIXED**

- **Delete-side closed** by T1.1 (orphan removal scoped to this investment's expenses) — a stray manual number can no longer be deleted unless it equals one of this investment's own expense ids.
- **Append-side closed** by the T1.4 fix — appends no longer target a computed row, so a manual number can't be overwritten by an append.
- **Update-side residual (open):** `applyMaterialRowsBatch` still maps id→row, so a manual row whose id-cell equals _this investment's active expense id_ would be overwritten in place. Fully closing it needs id **namespacing** (e.g. write `#<id>` and parse only prefixed cells as app ids) — a data-format change with a one-time re-sync migration. **Needs a decision** (small follow-up); the tab is SA-protected, so manual rows there are already an edge case.

`isTransferId` accepts any `Number.isFinite` value; nothing distinguishes app-written ids from manual numbers. Since transaction ids are sequential integers, low/mid-range manual numbers collide readily.

**Trigger:** owner types `2024` (a year/qty) in the id column. If txn #2024 is an active expense here, `updateMaterialRow` overwrites that manual row; otherwise the orphan path can delete it.
**Fix:** namespace the app's id cells (e.g. a hidden marker column, or a prefix like `#<id>`), so manual numerics are never mistaken for sync keys. This is the common root of T1.1/T1.4/T1.5.

---

## Tier 2 — Sync drift / consistency holes

### T2.1 ◐ Concurrent single creates race on the append row → one expense lost

**`src/lib/google/sheets.ts` ← `src/lib/actions/transfers.ts:72`** — CONFIRMED → **MITIGATED (not fully closed)**

- Initially fixed with `spreadsheets.values.append` (server-side row allocation), but **live testing revealed `values.append` is unusable here**: its table detection treats the adjacent summary column (H) as part of the table and appends _below_ the shared row, leaving the first data row permanently **blank**. Reverted.
- Appends now compute the target row explicitly (row after the last non-empty A–G cell) and write via `batchUpdate`. The **batched reconcile stays one call** (the T4.1 scale fix holds), but two **concurrent single-creates** to the same investment can still compute the same row, so one overwrites the other.
- **Residual accepted:** concurrent creates to one investment are rare and the drift self-heals on the next reconcile (worst case: one row briefly missing). Fully closing it needs cross-request serialization — deferred (see T5.1).
- **Live-verified (2026-05-28, inv 6):** reset→resync appended all 36 expenses with no blank row; single edit updated in place; totals match the investment page.

`appendMaterialRow` is read-then-write with no cross-request lock. The authors serialized the _bulk_ path (`transfers.ts:157`, with a comment naming this exact hazard) but the single-create `after()` is unguarded.

**Trigger:** two near-simultaneous expense creates for the same investment → both read the same `lastDataRow`, both write the same `rowIndex`, second overwrites first → one expense silently missing.
**Fix:** route all sheet writes through one serialized primitive (see T5.1), or use `spreadsheets.values.append` (server-side row allocation) instead of compute-then-write.

### T2.2 ☐ Transaction mutations via Payload admin / bare `payload.*` bypass sheet sync

**`src/hooks/transfers/recalculate-balances.ts` (afterChange/afterDelete)** — CONFIRMED

Sheet sync lives only in the four server actions. The collection's `afterChange`/`afterDelete` hooks revalidate cache only — no sheet call. Any mutation not going through the actions (admin panel edit/delete, scripts) desyncs silently.

**Trigger:** edit/delete an `INVESTMENT_EXPENSE` in `/admin` → balances revalidate, sheet drifts until manual reconcile.
**Fix:** either lock down admin editing of transactions, or move sheet sync into the collection hook (revalidate-context-safe), so it fires regardless of entry point. (Note: project convention is side-effects-in-action — that only holds if the action is the sole write path.)

### T2.3 ☐ `updateTransferAction` leaves a stale row when `investment` is omitted

**`src/lib/actions/transfers.ts:314` + `src/lib/schemas/transfer.ts:130`** — CONFIRMED (latent)

`investment` is `.optional()` in the update schema. `newInvestmentId = fields.investment`; if omitted it's `undefined`, the `oldInvestmentId !== newInvestmentId` removal guard short-circuits, and `syncSingleTransferToSheet` re-resolves the (possibly changed) investment from the DB and appends → row on two sheets.

**Trigger:** any update payload that omits `investment` while the effective investment differs from the original. The app form likely always sends it, but the schema permits the hole.
**Fix:** require `investment` in the update path, or resolve old-vs-new from the DB inside the sync layer (see T5.1), not from the payload.

### T2.4 ☑ Editing an expense to clear its category (or non-finite amount) leaves a stale row

**`src/lib/actions/sheets-sync.ts:300`** — CONFIRMED

`syncSingleTransferToSheet` builds `expenseRow`; on `undefined` (category cleared → empty `typ`, or amount fails `finiteAmount`) it early-returns **without** updating or removing the previously-synced row. `updateTransferSchema` makes `expenseCategory` optional, so this is reachable.

**Trigger:** edit a synced expense to clear its category → stale row (old typ/amount) lingers and keeps feeding SUMIF totals until a full reconcile.
**Fix:** on a failed row-build for an already-synced transfer, remove its existing row rather than returning.

### T2.5 ⊘ `updateTransferAction` sync is gated on `original.type === 'INVESTMENT_EXPENSE'`

**`src/lib/actions/transfers.ts:309`** — REFUTED on inspection → **WON'T-FIX (by design)**: `updateTransferSchema` has no `type` field, so a transfer's type is **immutable on edit**. A non-expense can never become an `INVESTMENT_EXPENSE` through this action, so gating the sync on `original.type` is correct and complete. No code change.

~~The post-response sync block only runs when the _original_ type was an expense. An edit that newly makes a non-expense into an expense (sets investment + expenseCategory) skips sync entirely.~~ (premise false: type can't change on edit.)

**Trigger:** edit a non-expense transfer into an `INVESTMENT_EXPENSE` → never lands on the sheet until manual Synchronizuj.
**Fix:** gate on the _resulting_ type (or both), not just the original.

### T2.6 ☐ Renaming an expense category does not re-sync the sheet

**`src/collections/expense-categories.ts`** — CONFIRMED

The category `afterChange` only revalidates a cache tag. `setupMaterialyTab` bakes literal category names into SUMIF criteria (`=SUMIF(C:C,"<name>",E:E)`) and into per-type color rules. A rename leaves stale literals → that type's total reads 0, colors stop matching, until a manual reset+resync. The code comment at `sheets.ts:373` acknowledges healing requires a manual reset.

**Trigger:** rename a category in admin → per-type totals zero out silently.
**Fix:** propagate category rename to all linked sheets (re-run setup / flag dirty for the reconciler), or stop embedding mutable literal names as the join key.

### T2.7 ☑ `resolveHeaders` first-match maps to the wrong column on a duplicate keyword

**`src/lib/google/sheets.ts:149`** — CONFIRMED

Each field binds to the FIRST column whose header contains its keyword (`findIndex`); no duplicate detection. `id` is exact-match (immune), but `date/typ/opis/kwota/kategoria/notatka` use `.includes`.

**Trigger:** owner adds e.g. `Kategoria robót` left of the app's `kategoria` column → category reads/writes land in the owner's column, no error (all 7 fields still "found").
**Fix:** detect duplicate matches and fail loudly, or anchor matchers to exact header strings written by setup.

### T2.8 ☑ Auto-provision writes `googleSheetId` after the cache is already revalidated

**`src/lib/actions/investments.ts:56`** — CONFIRMED

`createInvestmentAction` revalidates `['investments']` synchronously, then a fire-and-forget IIFE provisions the sheet and updates `googleSheetId`. The write happens _after_ revalidation, so `hasSheet` stays `false` in cache.

**Trigger:** create an investment → listing/banner show "Dodaj kosztorys" and the kosztorys page shows no-sheet until an unrelated mutation invalidates the tag.
**Fix:** revalidate `['investments']` again inside the IIFE after the `googleSheetId` update lands.

---

## Tier 3 — UX / correctness-adjacent

### T3.1 ☐ Preview under-reports; confirm button disabled when only updates/removals are needed

**`src/lib/actions/sheets-sync.ts:154` + `src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx:153`** — CONFIRMED

`previewMaterialSync` computes only `toAppend`. `applyMaterialSync` also updates and removes. The confirm button is `disabled` when `toAppend.length === 0`, and the dialog says "Wszystko jest już zsynchronizowane". So when the sheet only needs heals/removals (stale amount, cancelled-expense row), the non-destructive sync path is **unreachable** — only the destructive reset wipes+rebuilds.

**Fix:** have preview compute `{toAppend, toUpdate, toRemove}` and enable confirm when any is non-empty; surface all three counts.

### T3.2 ☑ `getServiceAccountEmailAction` bypasses `protectedAction`, throws, caller has no `.catch`

**`src/lib/actions/investments.ts:136` ← `src/components/dialogs/kosztorys-setup-dialog.tsx:42`** — CONFIRMED

The only action in the PR not wrapped in `protectedAction`/`requireAuth`; it `throw`s (not error-result) when `GOOGLE_SERVICE_ACCOUNT_JSON` is unset; the caller does `void …then(setSaEmail)` with no `.catch`.

**Trigger:** missing env → unhandled promise rejection + silently empty SA-email hint. Also callable without a management role (leaked value is a non-secret email, but the bypass is inconsistent).
**Fix:** wrap in `protectedAction`, return an error result, add `.catch` at the call site.

### T3.3 ☐ Embedded Sheets iframe has no sandbox/CSP and no desktop fallback

**`src/app/(frontend)/inwestycje/[id]/kosztorys/iframe-view.tsx`** — PLAUSIBLE

No `referrerPolicy`/CSP `frame-src` documented; with third-party cookies blocked (Safari default) the embed can render a Google sign-in wall. The fallback only triggers below `lg`.

**Fix:** add a desktop "open in Google Sheets" fallback + an explainer; document the frame-src expectation.

### T3.4 ☐ `verifySheetAccess` write-probe rewrites the title to itself

**`src/lib/google/sheet-access.ts:37`** — PLAUSIBLE

The Editor-access check does a `batchUpdate` rewriting the title to its current value. Defensible (must verify write), but it races a concurrent rename and adds revision-history noise on every link/retry.

**Fix:** if a cheaper write-permission signal exists, prefer it; otherwise document the trade-off.

---

## Tier 4 — Cleanup (reuse / simplification / efficiency)

### T4.1 ☑ Per-row full-grid re-reads make sync O(N) Google API calls

**FIXED**: `applyMaterialRowsBatch` does one `readGrid` + at most three writes (one `values.batchUpdate` for all updates, one `values.append` for all appends, one `spreadsheets.batchUpdate` for all deletes), regardless of row count. `applyMaterialSync` and `syncSingleTransferToSheet` both route through it. Verified must-fix by the 1000+ scale answer.

**`src/lib/google/sheets.ts` (`appendMaterialRow`/`updateMaterialRow`/`readGrid`), `src/lib/actions/sheets-sync.ts:191`** — efficiency, highest-impact cleanup

Each `appendMaterialRow`/`updateMaterialRow` independently re-reads the whole `A1:Z1000` grid (~26k cells); `applyMaterialSync` calls them per row, and `syncSingleTransferToSheet` reads the grid via `readMaterialyTransferIds` then again inside append/update. Root cause: the low-level helpers each `readGrid` with no way to share an already-read grid.
**Fix:** let helpers accept a pre-read grid + header map; read once per action and issue a single `values.batchUpdate` carrying all rows. Collapses 2N calls to ~2. (Also removes the concurrency surface behind T2.1.)

### T4.2 ☐ Bulk `after()` syncs line items one-by-one

**`src/lib/actions/transfers.ts:157`** — efficiency

Each item re-fetches the investment's `sheetId` and re-reads the grid. Bulk items share one investment → resolve sheetId + read grid once, batch all appends.

### T4.3 ☑ `serviceAccountEmail()` duplicated

**`src/lib/google/sheets.ts:131` vs `src/lib/google/sheet-access.ts`** — reuse. Import the exported one; delete the local copy (`investments.ts` already imports from `sheet-access`).

### T4.4 ☑ `relName()` duplicates `getRelationName()`

**`src/lib/actions/sheets-sync.ts:36`** — reuse. `src/lib/get-relation-name.ts` already does object-vs-id `.name` extraction; call it (pass `''` fallback).

### T4.5 ☑ Preview amount rendered as raw `${r.amount} zł`

**`src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx:129`** — reuse. Use `formatPLN` from `@/lib/format-currency` for pl-PL formatting consistency.

### T4.6 ☐ `Section` component over-built

**`src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx`** — simplify. `tone` red/yellow entries + the `items.length === 0` branch are unreachable (single render, `tone="green"`, caller short-circuits on empty). Inline the single list or hardcode the emerald dot.

### T4.7 ☑ Stale "append-only / nothing is ever deleted" comments

**`src/lib/actions/sheets-sync.ts:151`, `src/lib/google/sheets.ts:273`** — simplify. Leftovers from the reversing-row model; the code now updates and removes. Delete/rewrite to describe reconcile behavior.

### T4.8 ☑ `updateMaterialRow`/`appendMaterialRow` duplicated write block

**FIXED**: both removed; the duplicated value-mapping is now shared helpers (`valuesByField`/`cellDataForRow`/`rowArray`) feeding the single `applyMaterialRowsBatch`. `removeMaterialRow` delegates to it too (one delete path).

**`src/lib/google/sheets.ts`** — simplify. ~20 lines copy-pasted, differing only in target row. Have append compute its row then delegate to update. (Folds into T4.1.)

---

## Tier 5 — Altitude (architecture)

### T5.1 ☐ Sheet sync hand-wired into each mutation action instead of centralized

**`src/lib/actions/transfers.ts` (create:72, bulk:157, cancel:248, update:315)** — altitude

Every expense write path must remember to call sync, and update re-implements old-vs-new investment routing inline. A 5th mutation path silently won't sync (this is the root of T2.1–T2.5, T2.2).
**Deeper fix:** one sync dispatcher keyed on `transferId` that reads current DB state and decides append/update/remove (and which sheet the row currently lives on), invoked from exactly one place — ideally the collection hook so it can't be bypassed. Owns the serialization invariant (T2.1) where `appendMaterialRow` lives.

### T5.2 ☐ No guaranteed / scheduled reconciler

**`src/lib/actions/sheets-sync.ts`** — altitude

Per-mutation syncs swallow errors as "non-fatal, recoverable via the sync button", but recovery is a human remembering to click per investment. "Eventually consistent" has no "eventually".
**Deeper fix:** pair optimistic sync with a cron / on-load reconcile-if-stale so the swallowed-error design has a real backstop.

### T5.3 ☐ `TYPE_COLORS` hardcoded by category name

**`src/lib/google/sheets.ts:321`** — altitude (low severity)

New categories get gray until a developer edits the constant and redeploys — a code change for reference data, inconsistent with the (correctly generalized) header mapping.
**Fix:** add a `color` field to `expense-categories` and pass it through `setupMaterialyTab`.

---

## Refuted (checked, not a bug)

- **Conditional-format tint hardcodes `$C2`** — REFUTED. `setupMaterialyTab` writes the header in fixed A–G order in the same call (`MATERIALY_HEADER`, `typ` = column C by construction); the header-keyword resolver is used only by the sync read/write path, never by format emission. `$C` correctly targets `typ`.

---

## Suggested merge gate

- **Block staging→main on Tier 1** (T1.1–T1.5): all are silent data-loss paths. T1.1 + T1.5 share one root (id-as-join-key with a permissive parser) — fixing namespacing + query scoping closes most of Tier 1 at once.
- Tier 2 can land as fast-follows but T2.2 (admin bypass) and T2.6 (rename) are user-visible drift.
- Tiers 4–5 are quality/perf; T4.1 + T5.1 are the same refactor and would also dissolve T2.1.
