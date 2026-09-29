# Audit of the `e2e-backlog` backlog — 71 issues, 2026-09-15

Brief: (1) drop what is stale, (2) put the rest through the test "cost of the spec vs. what it buys".
Condensed at archive time: each item keeps its verdict, the layer reason, and the spec it landed in.
Paths are current as of 2026-09-29 (`e2e/helpers.ts` has since been split into `e2e/support/` +
`e2e/drivers/`, EX-816).

## Conclusions in three sentences

1. **The backlog wasn't too big — it was on the wrong layer.** The repo had ~330 node unit specs and
   a handful of Playwright tests, with **nothing in between**: no `@testing-library/react`, no
   `jsdom`. Every render risk had two prices — a pure-logic test or a full `build` + server + DB run.
   So 71 entries were not "things worth a browser", but "everything a function couldn't compute".
2. **~25 items were real risks on the wrong layer, not junk.** Header/data drift (EX-743), a comma in
   a cell draft (EX-738), a pill going out under parallel saves (EX-656) — a component test catches
   each in ~50 ms. Deleting them throws the signal away; moving them keeps it at 1/1000 of the cost.
3. **A red spec doesn't always mean "fix it".** `kosztorys-reconciliation.spec.ts` (EX-676) burned
   ~8 min of every run since 2026-08-07 on a dead locator — but the risk it guarded (two surfaces
   silently diverging) had been designed out: both call the same function and feed the same
   component. **Deleted, not fixed.** Every item here faces that test: not "can it be fixed" but
   "does the risk still exist".

## What one E2E spec really costs

| Item                           | Value                                           | Source                                  |
| ------------------------------ | ----------------------------------------------- | --------------------------------------- |
| Full suite run                 | ~1 h                                            | owner ruling recorded in EX-781         |
| Tests in the suite then        | 14 in 10 files (32 spec files in `e2e/` today)  | `e2e/`                                  |
| Start-up before first assert   | full `pnpm build` + `pnpm start`, 600 s budget  | `playwright.config.ts` → `webServer`    |
| Parallelism                    | `workers: 1`, `fullyParallel: false`            | same — the whole suite runs serially    |
| Test / assertion timeout       | 120 s / 20 s                                    | same — **a red spec costs 2 min, not 2 s** |
| Seed per spec                  | `pnpm seed:*` subprocess in `beforeAll`         | e.g. `kosztorys-share-link`             |

> The test-suite-audit research later counted 9 tests in 8 files at that date, not 14 in 10.

The marginal cost of a spec is its own time **plus** its share in nobody running an hour-long suite
before a push. A suite nobody runs is worth zero however many tests it holds.

## Top recommendation — build the component layer

Before writing **any** spec from this list: `vitest` + `jsdom` + `@testing-library/react`. One day's
work that moves ~25 items from the hour-long suite to a millisecond one. EX-677 was filed **because**
"the repo has no harness to render React", and EX-550 Risk 2 said the same. The backlog had named the
gap for months and bounced each risk to Playwright. **Built 2026-09-15** — its rules live in
`AGENTS.md` → Testing. Its first spec, `section-header-cell.test.tsx` (150 ms), covers the
2026-09-14 production bug where space in the section-name input collapsed the section: the band is
`role="button"` with the input inside, so every keystroke also reached the band handler.

---

## Findings

### Canceled outright (4)

- `EX-412` · Harness phase 2 — a STOP POINT note whose checklist had all landed; the live remainder
  was EX-473. Double bookkeeping of one symptom.
- `EX-544` · Reconciliation parity across two surfaces — already written in
  `kosztorys-reconciliation.spec.ts`; gone with EX-676 but no gap left: the verdict has 14 unit tests.
- `EX-676` · `kosztorys-reconciliation.spec.ts` — 4 tests × 120 s. **Deleted, not fixed**: the editor
  and the investment summary panel both call `buildKosztorysReconciliation` and feed the same
  `SettlementSummary`. Guarded by `src/__tests__/lib/kosztorys/reconciliation.test.ts` +
  `financial-golden-master-db`, `investment-render-parity-db`, `investment-financial-fields`.
- `EX-582` · "Run the band spec from the main tree" — every full run since 2026-07-26 had run it.

### Fixed immediately — a broken tool, not backlog (1)

- `EX-473` · `transfer-create` / `transfer-cancel` — **not a flake but a dead fixture.**
  `'Plac Hellera 3'` didn't exist on 5435 (it's `Plac Hallera 6`), so a missed click left a popover
  open and the next iteration hung to timeout; behind it a second rot: the submit button is now
  „Zapisz", not „Dodaj". Both green after the fix. They stay E2E: register balances are computed on
  read and transfer hooks only invalidate tags — no lower layer sees that seam.

### STAYS in E2E — the browser is the only instrument (28)

Criterion: the risk lives only on the write → cache tag → RSC render seam, on a sessionless route, in
file ingest, or on something that deletes data.

**Priority:**

- `EX-731` · A booked transfer moves the investment figures (pure cache tag) →
  `investment-expense-figures.spec.ts`. No „Odśwież dane" click between write and read.
- `EX-550` · Share link can't be unlocked into the subcontractor cost base via a planted
  `localStorage` view key; zero `a[href]` on the public page → added to `kosztorys-share-link.spec.ts`.
  Risk 1 was already covered there.
- `EX-634` · The v2 panel is blind to table filters (figures stand under disjoint filters) →
  `investment-panel-filters.spec.ts` on `pnpm seed:panel-filter-blind`.
- `EX-741` · Notification recipient lists — stake is mail to real staff addresses →
  `notification-recipients.spec.ts`; "empty list refused" and the MANAGER gate went down to DOM
  (`recipient-list-form.test.tsx`, `recipient-list-card.test.tsx`) — both are a render fact.
- `EX-723` · Cash on a gross investment: warning → „Zapisz mimo to" → red row →
  `deposit-settlement-plane.spec.ts`. Mode set through the UI, not a seed (a freshly seeded
  investment 404s on `kosztorys_v2` via `fetchReferenceData`).
- `EX-684` · A loss lowers the client's debt, three mechanisms must agree →
  `investment-loss.spec.ts` (face value on net and gross, not 1.23×).
- `EX-769` · Lock on a finished investment, three planes → `investment-lock.spec.ts`. Status set via
  the real „Edytuj inwestycję" dialog — the only path that invalidates `fetchReferenceData`. Server
  refusals already unit-tested; not repeated.

**Destructive — deleting data, so a missing guard is the most expensive (5):**

- `EX-719` · „Wyczyść kosztorys" + restore → `kosztorys-versions.spec.ts` test 1. The sheet-import leg
  stays below the browser (full unit/DB/DOM coverage; the browser remainder is the same
  `replaceTreeWithSnapshot` path, at the price of a live Google dependency).
- `EX-674` · merged into `EX-442` (see below).
- `EX-520` · Delete item/section/stage behind confirm + snapshot → `kosztorys-deletes.spec.ts`, one
  test per target (each wrecks part of the fixture). **Stale premise:** "deleting without progress
  doesn't ask" — the confirm is now unconditional.
- `EX-428` · „Wersje" drawer + restore → `kosztorys-versions.spec.ts` test 2 (same surface, same file);
  restore writes an automatic point first, so a mistaken restore is reversible too.
- `EX-510` · **Canceled** — the "block deleting an item with executed work" no longer exists (EX-477
  reversed the policy: delete behind confirm); the remainder is EX-520's legs.

**File ingest — Playwright is the only way (5, as ONE spec file):**

- `EX-732` HEIC from the transfer-edit picker saves as `image/jpeg` · `EX-661` multi-page invoices ·
  `EX-663` appending pages from the table picker · `EX-460` HEIC receipt guards · `EX-444` fill from
  receipts → **`invoice-ingest.spec.ts`**. HEIC decode is canvas/WASM, compression is CompressorJS,
  the 4 MB cap measures post-compression bytes, and photo↔row pairing lives only in React state.
  `/api/extract-receipt` is stubbed with `page.route` (model output isn't deterministic). **Stale
  premises:** EX-663 said the „Dodaj fakturę" dialog was removed — it's back; EX-444/661's two buttons
  are now one „Wygeneruj z paragonów" + a mode switch.

**Public route / data disclosure (4, as ONE spec file):**

- `EX-696` preview settings reach the link · `EX-721` „Oferta / Rozliczenie" variants · `EX-570`
  expense list + invoice download · `EX-681` deposit list → **`client-share.spec.ts`** on
  `pnpm seed:client-share`. `(share)/layout.tsx` mounts no `CurrentUserProvider`, so the only
  boundary is the `PREVIEW_VISIBLE_COLUMNS` allowlist plus pinning the price plan to `client`; the
  question is "what does a stranger see at this URL", not "what does a function return". A view
  filter must never be a figure filter. **Stale premise (EX-570):** there is no „Materiały wliczone
  w robociznę" tab on the share page — `clientVisibleExpenseRows` drops the `settled` bucket.

**Kosztorys grid — write and read (2, as ONE spec file):**

- `EX-497` „Pomiar" is read-only and equals the stage sum · `EX-604` `deferRefresh` has no end-to-end
  guard → **`kosztorys-grid-writes.spec.ts`**. Same gesture, two questions (what it shows / what it
  does underneath). A broken save is invisible in the session that made it, so reload is the only
  honest read; refresh coalescing asserts **fewer than one RSC request per edit**, not exactly one.
  **Stale premise:** the column is now „Pomiar (razem etapy)", not „Pomiar z natury".

**Google Sheet path — moved to the component layer (2):**

- `EX-671` import preview → confirm → apply · `EX-687` „Porównaj z arkuszem" / „Zaciągnij pomiary" —
  **DEMOTED.** Both read the sheet **server-side**, so `page.route()` can't intercept; an E2E would need
  an env-gated test door in `getReadonlySheetsClient()` — production code that exists only for a test,
  on a path reading other people's sheets. The one uncovered risk (the editor actually remounts onto
  the imported kosztorys) is React lifecycle → `use-restore-remount.test.tsx`. `EX-686` goes the same
  way.

**Net expense and deposit dialog (2):**

- `EX-576` · Net expense — form gating + net line → `investment-expense-netto.spec.ts`. The one type
  where the register loses **gross** and the investor is charged **net**. Immutability of
  `amount`/`netAmount`/`type` is a Payload `access` rule — tested where it lives.
- `EX-679` · Role gate in the deposit dialog — **DEMOTED** → `deposit-type-role-gate.test.tsx`. The
  MANAGER rule is deliberately client-only, so the rendered option list is its only observable.

**The rest, no urgency (3):**

- `EX-668` · Listing expense/balance columns — **DEMOTED.** Half the to-do was stale; the arithmetic is
  held by `investment-render-parity-db.test.ts` for **every** investment. Real gap: 0
  `INVESTMENT_EXPENSE_NET` rows in the test DB, so both DB specs passed comparing nothing → added
  `pnpm seed:materials-net:test` + a dataset floor in the parity spec (verified both ways).
  Golden-master fingerprint not hashing settlement fields → `EX-784`.
- `EX-728` · 404 for a missing investment + the materials tab → `kosztorys-route-guards.spec.ts`.
  Measures the **status code** — the regression rendered a plausible page under 200.
- `EX-771` · Equipment registry (add → hand over → "where is it") → `equipment-registry.spec.ts`.

### DEMOTED — real risk, wrong layer (23)

Each is a fact about the rendered DOM or a hook state transition. Every spec was verified in reverse:
breaking the source fails exactly the test guarding it.

- `EX-743` · Column toggle drops `<th>` but keeps `<td>`. Only reproduces in a build (React Compiler
  is a Babel plugin, absent under vitest), so the spec pins the fix's mechanism — the visible-column
  set is part of the row key → `src/__tests__/components/tables/data-table/data-table.test.tsx`.
- `EX-656` · Parallel „Opcje rozliczenia" saves clear each other's pill → `use-kosztorys-settings.test.tsx`.
- `EX-655` · A failed receipt scan jams the form → `use-receipt-generation.test.tsx`.
- `EX-677` · The margin tab reads the same plane → `summary-panel-content.test.tsx`.
- `EX-738` · Numeric cell edit contract (comma, revert, toast) → `decimal-cell.test.tsx`; paste/Delete
  are pure functions (node specs).
- `EX-767` · Subcontractor price source, auto vs explicit 0 zł → `subcontractor-columns.test.tsx`.
- `EX-742` · Settlement choice leaks between dialog openings → `dialogs/sheet/sheet-import-dialog.test.tsx`.
- `EX-762` · Amount reset on „auto" → `work-catalogue-item-form.test.tsx` (the ~950-row filtering half
  was a perf measurement, cut).
- `EX-657` · Long-text cell overlay → `ui/datasheet-grid/long-text-cell.test.tsx`; "nothing shows
  through" is visual → manual register.
- `EX-757` · Row height / description wrap — the risk is column-width measurement lost on horizontal
  scroll → `use-wrap-column-widths.test.tsx`.
- `EX-610` · Section footer figures under their columns → `kosztorys-synthetic-rows.test.tsx`.
- `EX-484` · Per-stage value columns → `stage-value-headers.test.tsx` + `use-hidden-columns.test.tsx`.
- `EX-689` · **Partly demoted** — sort scope in the column menu → `sort-menu-items.test.tsx` +
  `menus/kosztorys-row-actions-menu.test.tsx`. Points 4–6 (baking order into the DB, reload, undo)
  stay E2E.
- `EX-614` · Subcontractor price edit — Escape, Enter, virtualization → `subcontractor-price-edit.test.tsx`.
- `EX-511` · Inline section rename + no write on no-op → `section-name-cell.test.tsx`.
- `EX-563` · „Gotówka/Przelew" picker → `deposit-payment-method.test.tsx`.
- `EX-715` · **Partly demoted** — active-filter bar + section collapse → `search-filter-input.test.tsx`,
  `kosztorys-active-filters-bar.test.tsx`, `section-header-cell.test.tsx`. Point 3 (sections
  collapsed before sharing arrive collapsed on the link) stays E2E, for `client-share.spec.ts`.
- `EX-651` · Settlement block in the summary panel → `settlement-block.test.tsx`. **Stale premise:**
  Mixed mode no longer has two lanes (owner ruling 2026-08-20, `c7b62b64`).
- `EX-559` + `EX-637` · Subcontractor summary + per-worker attribution → `blocks/subcontractor-summary.test.tsx`
  + `reassign-worker-confirm-dialog.test.tsx`.
- `EX-638` · Stuck balance spinner + deactivated assigned worker → `use-register-balance.test.tsx` +
  `stage-worker-section.test.tsx`.
- `EX-568` · Stage tool-plane choice rebuilds the summary → `stage-header-plane.test.tsx`.
- `EX-740` · Column reorder survives reload → `src/__tests__/components/tables/data-table/data-table-column-order.test.tsx`;
  the pointer drag itself stays untested.
- `EX-617` · canceled (see below).

### Cancellations and merges — done with consent 2026-09-15 (6)

- `EX-456` · "Print" for an invoice — needs a stubbed `window.print`, popup handling is brittle, one
  past regression now held by a load-bearing code comment. High cost, low signal.
- `EX-762` · the ~950-row filtering half cut (perf number is noise in a serial suite).
- `EX-617` · "empty state renders the empty state" — not worth more than a DOM test.
- `EX-505` + `EX-752` → merged into `EX-472` (menu-driven structure changes persist; one spec).
- `EX-674` → merged into `EX-442` („Wczytaj szablon…", one dialog, one spec).
- `EX-510` → merged into `EX-520`.

### Unchanged (6)

- `EX-781` · Screen order = print order → `transfer-sort-and-print.spec.ts`. Each order was correct
  alone; the EX-777 regression only shows side by side (server `payload.find` vs a client sort).
- `EX-502` · Global discount → `kosztorys-global-discount-overrides.spec.ts`, rewritten: no second
  totals surface any more, and „%" is a one-off stamp, not a mode. „Kwotowy" **bypasses** per-item
  discounts without deleting them and pulls the four discount columns from the grid.
- `EX-627` · „Suma wybranych transakcji" tile = sum of rows → `transfer-sum-tile.spec.ts`. The list is
  a Payload `Where`, the tile raw SQL built from it via `stripCancelledFilters`; the EX-574 drift came
  from a cancellation copying the original's amount with `cancelled = false`.
- `EX-528` · „Planowana" status → `investment-planowana-status.spec.ts`, narrowed to one fact on two
  surfaces: a prospect is not an active investment (not in the „N aktywnych" count, not offered in
  the expense picker).
- `EX-756` · Work catalogue → `work-catalogue.spec.ts`. Catalogue rows created through the UI, not a
  seed: the price list is one `unstable_cache` entry only its own save action invalidates.
- `EX-716` · Fleet inspections → DOM specs (`inspection-form`, `deadline-cell`, `fleet-data-table`) +
  `fleet-inspections.spec.ts`. **A red test caught a production bug:** `prefillNextDue` checked
  `field.isTouched`, but TanStack Form marks every field touched on the first validation pass, so the
  suggestion froze on the first kind chosen. Fixed with a `suggestedNextDue` ref.

---

## Totals

| Verdict                                    | Count |
| ------------------------------------------ | ----- |
| Canceled outright                          | 4     |
| Canceled / merged with consent             | 6     |
| Fixed (broken tool, not backlog)           | 1     |
| Stays in E2E                               | 26    |
| Demoted to the component layer             | 23    |
| Unchanged                                  | 6     |

Result: **~29 items in E2E instead of 71**, and after merges **~20 spec files**, not 30. Every
demoted item was closed in Linear and taken off the `e2e-backlog` label.


The lesson from both fixed items (a timeout means a stale locator, not a slow machine) is in `context/foundation/lessons.md`.
