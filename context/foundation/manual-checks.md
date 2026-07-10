# Manual verification

One living checklist for every slice — the project's QA registry. Each `##` section is a slice/change; tick boxes by hand (or point an agent at a section: "drive these checks with Playwright and report" — the `verify-manual-checks` skill) as you verify. Lives in `context/foundation/` (not the change folder) so it survives `/10x-archive` and never freezes stale. A slice with unticked boxes here is **not `Done`** — manual checks are a hard blocker (see `/10x-implement`). Not gated by CI.

**Run against the isolated test DB, not the dev DB.** Manual checks mutate data, so point the app at the `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, `wykonczymy-test`) — the same DB the E2E suite uses — never the dev DB (5433, holds un-dumped local work) and never prod. Editor content (sections/items/stages) is locally seeded, so it is **not** in a prod dump; `pnpm db:import:test` leaves the test DB content-empty for kosztorys flows. Seed it separately: `perf-seed-kosztorys.ts` for a synthetic set (no external deps) or `seed-kosztorys.ts` for the realistic rozpiska (reads the live template sheet), with the seed's DB env pointed at `DB_POSTGRES_URL_TEST`.

## S-03 — kosztorys-stages

**In review** — pending author sign-off. Phases 1–3 manual rows already confirmed (1.5, 2.5, 2.6, 3.4); Phase 4 (Editor UI) below is the remaining gate.

Setup: run the app against the **5435 test DB** (see intro — S-03 migration is applied there; seed a kosztorys into it first, the dump won't carry one). Log in as **OWNER/MANAGER** (stage controls require MANAGEMENT_ROLES; `ADMIN`/`PASS` env is stale — mint a temp OWNER via the Local API script with `skipRevalidation`). Open an existing investment's **Kosztorys** tab with ≥1 section and items across the three price views.

### Phase 4: Editor UI — stages

- [ ] **4.5 — Add stage → new column; second stage → existing rows show 0.** `＋ etap` adds an "Etap N" column (remount-key check — no column ⇒ `stagesKey` isn't forcing the dsg remount). Second `＋ etap` → second column; existing rows show `0`, not blanks.
- [ ] **4.6 — Rename a stage via its header, persists across refresh.** Type a label, blur/Enter, reload → sticks. Empty label → header shows `Etap N` placeholder and persists `null`. Tabbing through with no change issues no write (no-op guard).
- [ ] **4.7 — Progress entry → Pozostało recomputes live; view toggle recomputes.** Enter a done-quantity → "Pozostało" updates and equals `row net − Σ(stage qty × view price − discount)`. Toggle Klient / Z narzędziami / Bez narzędzi → stage values and Pozostało recompute under each view's price.
- [ ] **4.8 — Progress persists across reload; no duplicate row on re-entry (upsert).** Reload → quantities persist. Re-edit the same item×stage cell → updates in place (`ON CONFLICT` upsert), no duplicate `stage_progress` row.
- [ ] **4.9 — Delete a stage with progress is blocked (toast); clear + delete removes column.** Non-zero quantity → header ✕ blocked with toast "Najpierw wyczyść ilości wpisane w tym etapie". Clear all to 0 → ✕ removes the column.
- [ ] **4.10 — EMPLOYEE no access; sections/items/reorder/discount unchanged; financials unchanged.** EMPLOYEE still can't open the editor. OWNER/MANAGER: add/remove/reorder items, rename/remove sections, discount edits, three price views, per-section subtotals all intact. Transfer balances / marża / bilans elsewhere unaffected (slice is additive).

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
