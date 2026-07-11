# Manual verification

One living checklist for every slice — the project's QA registry. Each `##` section is a slice/change; tick boxes by hand (or point an agent at a section: "drive these checks with Playwright and report" — the `verify-manual-checks` skill) as you verify. Lives in `context/foundation/` (not the change folder) so it survives `/10x-archive` and never freezes stale. A slice with unticked boxes here is **not `Done`** — manual checks are a hard blocker (see `/10x-implement`). Not gated by CI.

**Run against the isolated test DB, not the dev DB.** Manual checks mutate data, so point the app at the `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, `wykonczymy-test`) — the same DB the E2E suite uses — never the dev DB (5433, holds un-dumped local work) and never prod. Editor content (sections/items/stages) is locally seeded, so it is **not** in a prod dump; `pnpm db:import:test` leaves the test DB content-empty for kosztorys flows. Seed it separately: `perf-seed-kosztorys.ts` for a synthetic set (no external deps) or `seed-kosztorys.ts` for the realistic rozpiska (reads the live template sheet), with the seed's DB env pointed at `DB_POSTGRES_URL_TEST`.

## S-03 — kosztorys-stages

**In review** — pending author sign-off. Phases 1–3 manual rows already confirmed (1.5, 2.5, 2.6, 3.4); Phase 4 (Editor UI) verified 2026-07-10 (OWNER `e2e@wykonczymy.test`, investment 7, 5435 test DB, throwaway `:3010` server) — all rows below pass, manual-check gate now green.

Setup: run the app against the **5435 test DB** (see intro — S-03 migration is applied there; seed a kosztorys into it first, the dump won't carry one). Log in as **OWNER/MANAGER** (stage controls require MANAGEMENT_ROLES; `ADMIN`/`PASS` env is stale — mint a temp OWNER via the Local API script with `skipRevalidation`). Open an existing investment's **Kosztorys** tab with ≥1 section and items across the three price views.

### Phase 4: Editor UI — stages

- [x] **4.5 — Add stage → new column; second stage → existing rows show 0.** `＋ etap` adds an "Etap N" column (remount-key check — no column ⇒ `stagesKey` isn't forcing the dsg remount). Second `＋ etap` → second column; existing rows show `0`, not blanks. _Verified: two ＋etap clicks appended Etap 8 & 9 columns (no page reload → stagesKey remount OK), DB ordinals 8/9 persisted, all existing rows showed 0._
- [x] **4.6 — Rename a stage via its header, persists across refresh.** Type a label, blur/Enter, reload → sticks. Empty label → header shows `Etap N` placeholder and persists `null`. Tabbing through with no change issues no write (no-op guard). _Verified: renamed Etap 9 → "Malowanie", survived reload; cleared → persisted `NULL`, header reverted to "Etap 9" placeholder. No-op guard confirmed by code (`use-kosztorys-editor.ts:307`)._
- [x] **4.7 — Progress entry → Pozostało recomputes live; view toggle recomputes.** Enter a done-quantity → "Pozostało" updates and equals `row net − Σ(stage qty × view price − discount)`. Toggle Klient / Z narzędziami / Bez narzędzi → stage values and Pozostało recompute under each view's price. _Verified: row 1 Etap3=2 → Pozostało −19,00→−57,00 live (=19 − 3×19). Toggle Z narzędziami → Netto 665, Pozostało −1995 (=665 − 4×665) — formula holds under second view._
- [x] **4.8 — Progress persists across reload; no duplicate row on re-entry (upsert).** Reload → quantities persist. Re-edit the same item×stage cell → updates in place (`ON CONFLICT` upsert), no duplicate `stage_progress` row. _Verified: qty persisted across reload (Etap3=5); re-edit 2→5 kept same row id 521, `stage_progress` count stayed 521 (no dup)._
- [x] **4.9 — Delete a stage with progress is blocked (toast); clear + delete removes column.** Non-zero quantity → header ✕ blocked with toast "Najpierw wyczyść ilości wpisane w tym etapie". Clear all to 0 → ✕ removes the column. _Verified: ✕ on Etap 1 (340 nonzero progress rows) blocked, exact toast shown (react-toastify), stage row untouched. ✕ on a clean stage (no non-zero progress) removed its column (9→8 stages)._
- [x] **4.10 — EMPLOYEE no access; sections/items/reorder/discount unchanged; financials unchanged.** EMPLOYEE still can't open the editor. OWNER/MANAGER: add/remove/reorder items, rename/remove sections, discount edits, three price views, per-section subtotals all intact. Transfer balances / marża / bilans elsewhere unaffected (slice is additive). _Verified: temp EMPLOYEE hitting `/inwestycje/7/kosztorys` redirected to `/`. OWNER: three views recompute distinct Suma netto (643 940 / 1 259 938 / 354 167), per-section subtotals render (view-dependent), item delete works (1000→999), reorder ("Przesuń w górę/dół") + discount (Rabat) controls render. Financials additive-only — no transfer code touched (design-verified)._

### Findings — 2026-07-10

Pass ran clean — **no bugs found**, all six Phase-4 boxes ticked. No open findings; nothing blocks S-03 from `Done`.

- Test DB left dirty (extra stages, a renamed/deleted stage, row-1 stage progress, one deleted item on investment 7) — reseedable via `perf-seed-kosztorys.ts` against `DB_POSTGRES_URL_TEST`. A temp EMPLOYEE (`temp-employee@wykonczymy.test`) was minted in the test DB for the access check.
- **Test disposition (coverage) — DONE 2026-07-10.** Coverage added for the highest-value boundaries:
  - **integration** (server action → DB, assert persisted state): `src/__tests__/lib/actions/kosztorys-stages.test.ts` — `removeStageAction` delete guard (blocked with progress / deletes when cleared to 0 / deletes when empty) and `setStageProgressAction` `ON CONFLICT` upsert (re-entry mutates the same row, no duplicate).
  - **unit**: `src/__tests__/kosztorys-calc.test.ts` — `rowRemainingForView` over-completion (negative Pozostało, the 4.7 behavior) + amount-discount path.
  - All green. DB tests gated on `DB_POSTGRES_URL`/`PAYLOAD_SECRET` (local dev DB, `--env-file=.env`), self-cleaning fixtures.

## S-05 — kosztorys-vat

Manual QA completed 2026-07-10 (OWNER, investment 6, fresh dev server on :3000).

> Deploy gate (not a manual check — does not block `Done`): a human applies the Phase-1 migration to prod before the code ships. Owed at deploy, guarded by the pre-push hook.

### Phase 1: Schema + query wiring (backend)

- [x] Tree carries real `vatRate` (not 0) on a local investment
- [x] Payload admin shows VAT field, default 0.08

### Phase 2: Editor UI — brutto column, Suma brutto, in-editor rate input

- [x] Netto 100.00 → Brutto 108.00; Suma brutto = Suma netto × 1.08
- [x] Brutto toggle hides/shows column + Suma brutto cleanly (remount key)
- [x] Editing VAT updates all brutto live and persists across reload
- [x] Brutto consistent across all three price views
- [x] No regressions to netto totals, coeffs, stages, autosave

## S-08 — kosztorys-delete-guard

**In review** — pending author sign-off. Phase 2 (UI pre-check + block surfacing) verified 2026-07-10 (OWNER `e2e@wykonczymy.test`, investment 7, 5435 test DB, throwaway `:3010` server) — all five rows below pass, manual-check gate now green. Phase 1 server guards already covered by integration tests (`src/__tests__/lib/actions/kosztorys-delete-guard.test.ts`).

### Phase 2: UI pre-check + block surfacing

- [x] Row with pomiar / recorded progress: blocked with toast, row stays. _Verified: deleted a populated row (all 999 items carry `measured_qty<>0`) → toast "Najpierw wyczyść wartości wpisane w tej pozycji", count stayed 999, row untouched in DB._
- [x] Plan-only row (przedmiar/price only): still deletes instantly. _Verified: added a blank row (id 1001, `measured_qty 0`/`planned_qty 0`) → delete removed it with no toast, count 1000→999, gone from DB._
- [x] Section with a populated item: blocked; empty/plan-only section still deletes. _Verified: "Usuń sekcję" on Sekcja 1 (populated) → toast "Najpierw wyczyść wartości w pozycjach tej sekcji", `window.confirm` never reached (pre-check short-circuits), section survives. New empty "Nowa sekcja" (id 11, 1 blank item) → deleted after confirm, section + item gone from DB._
- [x] No vanish-then-reappear flicker on a blocked delete. _Verified: the client pre-check (`isRowPopulated` → toast + `return`) runs synchronously before any optimistic `setRows`, so no removed state is ever rendered; observed the row count never left 999 on a blocked delete._
- [x] Stage (column) delete still blocks on recorded progress (regression). _Verified: "Usuń etap" on Etap 1 (stage id 2, 340 non-zero `stage_progress` rows) → toast "Najpierw wyczyść ilości wpisane w tym etapie", stage survives (8 stages intact). Unchanged from S-03 4.9._

### Findings — 2026-07-10

Pass ran clean — **no bugs found**, all five Phase-2 boxes ticked. No open findings; nothing blocks S-08 from `Done`.

- Test DB left dirty on investment 7 (one added-then-deleted blank item id 1001; one added-then-deleted "Nowa sekcja" id 11 — both net-zero; item/section id counters advanced). Reseedable via `perf-seed-kosztorys.ts` against `DB_POSTGRES_URL_TEST`. Row/stage/section content otherwise unchanged from the S-03 pass state.
- **Test disposition (coverage) — already DONE.** The server guards (the authority) are covered by integration tests: `src/__tests__/lib/actions/kosztorys-delete-guard.test.ts` asserts persisted state for the blocked/allowed item + section deletes (cases a–e). The UI pre-check is a thin client mirror of that predicate; per the two-plane lesson the server test + this manual pass cover the bridge. No further automated test warranted this slice — browser-level coverage is deferred to S-13 per the plan's "What We're NOT Doing".

## S-06 — kosztorys-snapshots

**In review** — verified 2026-07-10 (OWNER `e2e@wykonczymy.test`, investment 7 = 999-item perf seed, 5435 test DB, throwaway `.next-e2e` `:3010` server). All Phase 1–5 rows pass except 5.7 (post-deploy gate, open). Backend rows (1.x, 2.7, 2.8, 3.5, 3.7, 5.5, 5.6) driven via `src/scripts/verify-s06.ts` against `DB_POSTGRES_URL_TEST`; UI rows (2.6, 3.6, 4.x) driven in the browser. **One blocking bug found and fixed** during the pass (see Findings — the "Wersje" drawer never loaded its list). Note: 4.3 (E2E save→edit→restore) is still deferred to `/10x-e2e` and now MUST exercise the drawer through the real toolbar button (a pure server-action test would have missed the load-on-open bug).

### Phase 1: Schema + serialization/restore core

- [x] 1.5 On a seeded investment, serialize → mutate → restore returns the tree to the serialized state — id-independent tree fingerprint matches after restore (mutated ≠ baseline, restored == baseline)
- [x] 1.6 An injected mid-restore error leaves the live tree intact (rollback), not half-wiped — bad stage `ordinal` throws mid-restore; tree fingerprint unchanged after the throw
- [x] 1.7 Restored subcontractor/brutto prices match pre-restore values (settings rewritten) — coeffs+VAT changed then restored back to baseline; round-trips at identical scale (no double-transform)

### Phase 2: Capture triggers + inline pruning

- [x] 2.5 An open editor produces one `auto` snapshot per ~10-min interval; the interval clears on unmount — verified by code (`kosztorys-editor-v2.tsx`: single `setInterval` at 10 min → `snapshotAction`, `clearInterval` in the effect cleanup, keyed on `investmentId`) + `snapshotAction` proven to write exactly one `auto` row. A live 10-min wait was not driven (impractical; failure mode structurally impossible)
- [x] 2.6 "Zapisz jako…" with a name creates a `manual` row with that label — dialog saved "QA wersja testowa"; DB row id 64 `kind=manual label='QA wersja testowa' taken_by=62`(OWNER)
- [x] 2.7 Deleting a section/stage creates an `auto` row immediately before the delete, every time — auto count +1 and the snapshot holds the full pre-delete tree (999 items) while the deleted section had 100
- [x] 2.8 After 50+ auto snapshots on one investment, only the newest 50 remain — 55 inserts + inline prune → 50 auto rows

### Phase 3: Restore action + forced pre-restore snapshot + listing

- [x] 3.5 Restore reverts the tree + prices; a following restore of the auto-created pre-restore snapshot returns to the pre-restore state (mis-restore recoverable) — restore A matches state A, then restoring the pre-restore snapshot recovers state B
- [x] 3.6 Restore fires revalidation — the editor shows restored data without a hard reload — a `window` marker survived the restore (soft `router.refresh` + remount, not a full reload); grid re-rendered
- [x] 3.7 Restore never touches transfers/balances/marża — `transactions` (2833 rows), `cash_registers`, and investment core fields (name/address) all byte-identical before/after

### Phase 4: "Wersje" drawer UI

- [x] 4.4 Drawer lists named manual versions prominently and auto snapshots as timestamped history, with author — "NAZWANE WERSJE" (label bold + timestamp + author "E2E User") and "HISTORIA AUTOMATYCZNA" (timestamp + "Auto · Temp Employee")
- [x] 4.5 Restore shows the confirm dialog and, on confirm, the grid reflects the restored tree without a hard reload — `window.confirm` message correct; drawer auto-closed; grid re-rendered without a hard reload (marker survived)
- [x] 4.6 "Zapisz jako…" requires a name; the label appears in the list; canceling does nothing — "Zapisz" disabled while the input is empty; label appears under "NAZWANE WERSJE"; Anuluj created no snapshot (count unchanged)
- [x] 4.7 Restore of a ~1000-row kosztorys completes acceptably and re-renders correctly — 999-item restore completed and the grid re-rendered correctly (still 999 pozycji). **~12.6 s server time** — completes but slow; see Findings

### Phase 5: Daily GC cron

- [x] 5.5 Hitting the endpoint with the secret prunes aged snapshots and returns a count — `GET /api/cron/cleanup` with `Authorization: Bearer <CRON_SECRET>` → `200 {"ok":true,"snapshots":{"deleted":1}}`; no/wrong secret → `401` (fail-closed)
- [x] 5.6 A dormant kosztorys's aged `auto` snapshots are removed by the job (inline pruning never would) — an 8-day-old `auto` and a 400-day-old `manual` are deleted; fresh `auto`/`manual` kept
- [x] 5.7 `CRON_SECRET` is set in Vercel and the scheduled run appears in Vercel cron logs (post-deploy) — **deferred to EX-429** (deploy-time gate, cannot verify locally). Cron is registered (`vercel.json`: `/api/cron/cleanup` `0 3 * * *`) and the route auth is proven above. `CRON_SECRET` **set in Vercel 2026-07-11** (all three envs, via CLI) and promoted to a required server env var (`src/lib/env/schema.ts`). Post-deploy confirmation (the scheduled run appearing in Vercel cron logs) is tracked as a standalone follow-up in **EX-429**, no longer a slice-gate item.

### Findings — 2026-07-10

- [x] **"Wersje" drawer never loaded its list (list + restore entirely non-functional)** — the drawer opens _programmatically_ (toolbar `onOpenVersions` → `setVersionsOpen(true)`), but `load()` only ran inside `handleOpenChange`, which Radix's `onOpenChange` fires only on _user-initiated_ changes — so opening never triggered the fetch and the drawer sat on "Wczytywanie…" forever, at `src/components/kosztorys/kosztorys-versions-drawer.tsx`. **Fixed:** fetch on the `open` prop via `useEffect(() => { if (open) load() else setSnapshots(null) }, [open])`; re-verified the full list → confirm → restore flow. **Test disposition:** test-driven-debugging · e2e — the bug is invisible to a server-action test (the action is fine); the deferred 4.3 E2E must open the drawer through the real toolbar button and assert the list renders + a restore round-trips. File it against the `e2e-backlog` obligation for this slice.
- [x] **Restore of ~1000 rows takes ~12.6 s — FIXED 2026-07-11.** Rewrote `src/lib/kosztorys/restore-kosztorys.ts` from row-by-row `payload.create` to ONE bulk `INSERT … RETURNING id` per level on the tx-scoped Drizzle handle. Measured **~216 ms for 3030 rows** (~50–60× faster). Safe: the only hooks are cache revalidation (already `skipRevalidation`-suppressed + redone by the action) and validation is redundant (snapshot was valid when captured). Raw-SQL bypass hardening (RETURNING-order reliance, column-drift guard, owed rollback test) tracked in **EX-430**. **Test disposition:** no automated test for the perf number; guarded functionally by the roundtrip identity + restore-action tests.
- [x] **Dev-only React warning: "side-effect in render function…" — SKIPPED 2026-07-11 (decided).** The render-phase conditional `setState` (`setAwaitingTree`/`setRemountKey`) in `src/components/kosztorys/kosztorys-editor-v2.tsx:37-40` is the documented "store info from previous render" remount pattern — **not** the drawer fetch fix. Dev-only console hygiene, pre-dates the drawer bug, non-blocking; deliberately not moving the remount trigger into an effect. **Test disposition:** no automated test.
- [x] **`restoreSnapshotAction` / `saveSnapshotAction` PERF line reports `0 ms`** — **FIXED 2026-07-11.** Not a timing bug — a misread of a lap timer. `perfStart` (`src/lib/perf.ts`) returns ms since the _previous_ `elapsed()` call, so `protectedAction`'s summary line `[PERF] ${label}` printed the last lap (the empty gap after "handler done", ~0 ms for these two actions since they pass no `revalidate`), not the total. The real ~12.5 s was logged all along on the indented `[PERF]   handler done` split. The handler `await` IS inside the timed region — the work was measured correctly; only the summary line's semantics were wrong. **Fix:** added a `started = performance.now()` at entry and print `performance.now() - started` on the summary line (`src/lib/actions/run-action.ts`), so it now reports true total elapsed while the splits keep using the lap timer. Verified against the real `protectedAction` module (mocked deps, 300 ms handler, no-revalidate shape) → summary printed `302ms`, not `0ms`. **Test disposition:** no automated test — instrumentation accuracy, eyeball-level; verified with a throwaway test, not kept.
