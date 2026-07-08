# Kosztorys — in-app editor (DRAFT)

> **Status (2026-05-28): WORKING DRAFT, mid-brainstorming.** The arc, stack, and
> coexistence model are locked in. **The data shape is still under discussion** —
> see "Open questions" below. Do not start implementation from this doc yet.
>
> Related: [docs/kosztorys-sync.md](../../kosztorys-sync.md) is the **current**
> sheet integration design (the materiały-mirror, untouched by this redesign).
> [docs/kosztorys-sheet-inspection.md](../../kosztorys-sheet-inspection.md) is
> the inspection tooling created during this session.

---

## 1 — One-paragraph summary

Today the kosztorys (line-item budget + 10-stage progress + per-room
measurements + summary) lives in a Google Sheet with 6 tabs per investment.
The app touches **only** one app-managed tab (`wydatki inwestycyjne (tylko do
odczytu)`) — that's the materiały-mirror documented in
[kosztorys-sync.md](../../kosztorys-sync.md). Everything else is "sheet land":
owner edits it manually, the app never reads or writes it.

This redesign adds an **in-app kosztorys editor** as a _secondary surface_
alongside the existing sheet flow. New page `/inwestycje/[id]/kosztorys`
becomes a two-tab layout: **Arkusz** (existing iframe, unchanged) and
**Edytor** (new in-app TanStack Table over Postgres). Owners choose which to
use per investment. The sheet integration is untouched. Eventually (separate
later phase, not this PR) the sheet integration is fully retired once no
investment still depends on it.

---

## 2 — The arc (why this is the right next step)

```
Phase 1 (shipped long ago)
  Sheet = source of truth for the kosztorys plan
  App   = source of truth for actuals (transfers, cash registers, investments)

Phase 2 (shipped — materiały-mirror, kosztorys-sync.md)
  Sheet still owns the kosztorys plan
  App pushes INVESTMENT_EXPENSE rows into a protected tab so the owner sees
  actuals next to the plan
  → "bridge" — connects the two worlds without merging them

Phase 3a (THIS REDESIGN)
  Add in-app kosztorys editor alongside the sheet. Both work simultaneously.
  No data flows between them. Sheet integration untouched.

Phase 3b (later, NOT this PR)
  Drop the sheet integration entirely once no investment still uses it.
  Materiały-mirror, drive.ts, sheet-access.ts, googleSheetId field — all gone.
```

The materiały-mirror was always transitional. It bridges the sheet-kosztorys
world to the app-actuals world. Once the kosztorys also lives in the app, the
bridge has no shore to connect to and is removed. That's not cleanup — that's
**completing the transition.**

---

## 3 — Decisions locked in

| #   | Decision                                                                                                                                                                                                                 | Rationale                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Replace the spreadsheet model with in-app editor**, do not generate sheets from DB.                                                                                                                                    | The generator is the expensive bit (~6 tabs × formatting/formulas/protected ranges). Avoid it entirely.                                            |
| D2  | **Stack: TanStack Table + `@tanstack/react-virtual` + `printViaIframe`.**                                                                                                                                                | All three already present in the codebase (`src/components/ui/data-table/*`, `src/lib/export/print*`). Zero new dependencies.                      |
| D3  | **Coexistence model: two tabs at `/inwestycje/[id]/kosztorys` — `Arkusz` and `Edytor`.** Equal billing, no default-mode flag, no auto-migration.                                                                         | Owner picks; no sync. Existing inv 6/31 stay on the sheet unchanged.                                                                               |
| D4  | **Sheet integration left intact for this PR.** Materiały-mirror keeps running. `googleSheetId` field stays.                                                                                                              | Strictly additive deploy. Lower risk.                                                                                                              |
| D5  | **No bidirectional sync.** The new editor does not read from or write to the sheet. The old sheet remains a separate, independent surface.                                                                               | Bidirectional sync is the most expensive feature to build correctly and we don't need it.                                                          |
| D6  | **Schema-level customisation is NOT supported.** No JSONB sidecars, no EAV, no per-investment custom columns.                                                                                                            | Spreadsheets get this for free but nobody actually uses it. The `komentarz` column carries everything ad-hoc.                                      |
| D7  | **Three pricing tabs collapse to one row × three price columns + a UI toggle.**                                                                                                                                          | Inspection confirmed: same `qty` data across the three sheet tabs, only the price changes. Three tabs were duplication, not three datasets.        |
| D8  | **Formulas live in code, never in cells.** Pure TS functions for per-row totals; `useMemo` reductions for section/grand totals; SQL aggregates for cross-table (plan vs. actual). Nothing persisted.                     | Excel's SUMIF/SUMPRODUCT chain is a denormalisation. In a DB you just compute.                                                                     |
| D9  | **Prices are snapshotted on `kosztorys_items` (per-investment), NOT joined from `work_catalogue`.**                                                                                                                      | Master price changes must not retroactively alter signed kosztorysy. Same pattern as Stripe `invoice_line_items.amount`.                           |
| D10 | **Stages are a child table (variable count), not 10 fixed columns.**                                                                                                                                                     | Sheet wastes 10 columns when a job has 3. Schema removes that constraint.                                                                          |
| D11 | **`stage_progress` is sparse** — only rows with non-zero `qty_done` exist.                                                                                                                                               | Smaller table, same semantics (missing pair = 0).                                                                                                  |
| D12 | **Customisation = templates + free row-level edits.** Master `work_catalogue` is reusable; per-investment `kosztorys_items` rows are freely edited; sections + stages are per-investment. No schema-level extensibility. | Notion-style flexibility is enormous engineering for zero observed demand. Templates capture the recurring shape; row edits cover everything else. |
| D13 | **`work_catalogue` (global master list) is opt-in for autocomplete, not enforced.** Owner can hand-type any item with no catalogue link.                                                                                 | Owners shouldn't be blocked on catalogue maintenance to add an item.                                                                               |

---

## 4 — Proposed data shape (UNDER DISCUSSION)

Six tables. See "Open questions" (§5) before treating this as final.

```sql
-- GLOBAL: master price list. Reusable across investments.
work_catalogue
  id
  section_name        text          -- "Klimatyzacja"
  description         text          -- "rury miedziane + skropliny + ułożenie"
  unit                text          -- mb | m² | szt | kpl | kontener
  default_client_price                numeric
  default_subcontractor_w_tools       numeric
  default_subcontractor_own_tools     numeric
  archived_at         timestamp?    -- soft-delete: hide from picker, keep FK targets
  created_at, updated_at

-- PER INVESTMENT: section list (categories the owner organises items by).
kosztorys_sections
  id
  investment_id       FK → investments
  name                text          -- "Klimatyzacja" — renameable per job
  display_order       int
  created_at, updated_at

-- PER INVESTMENT: variable-count stages (the old "10 etap" columns).
kosztorys_stages
  id
  investment_id       FK
  ordinal             int           -- 1..N — no hard cap
  label               text?         -- optional "wpłata zaliczki" / "stan deweloperski"
  UNIQUE (investment_id, ordinal)
  created_at, updated_at

-- PER INVESTMENT: the rows the owner edits in the table.
kosztorys_items
  id
  investment_id       FK
  section_id          FK → kosztorys_sections
  catalogue_id        FK → work_catalogue?   -- TRACEABILITY ONLY, not price source
  display_order       int

  description         text                    -- snapshotted, then editable
  unit                text                    -- snapshotted, editable
  planned_qty         numeric                 -- przedmiar (estimate)
  measured_qty        numeric                 -- pomiar z natury (on-site)

  client_price                  numeric       -- snapshotted, editable (D9)
  subcontractor_w_tools_price   numeric       -- snapshotted, editable
  subcontractor_own_tools_price numeric       -- snapshotted, editable

  note                text?                   -- komentarz
  created_at, updated_at

-- PER INVESTMENT: sparse progress (no row = 0 done).
stage_progress
  id
  item_id             FK → kosztorys_items
  stage_id            FK → kosztorys_stages
  qty_done            numeric
  completed_at        timestamp?
  completed_by        FK → users?
  UNIQUE (item_id, stage_id)
  created_at, updated_at

-- PER INVESTMENT: the pokoje tab.
rooms
  id
  investment_id       FK
  name                text          -- "kuchnia/salon" / "łazienka 1"
  wall_a, wall_b, wall_c, wall_d  numeric?
  height              numeric?
  area_m2             numeric
  perimeter           numeric
  wall_m2             numeric
  ceiling_m2          numeric
  has_ceiling_decor   bool
  has_baseboard       bool
  note                text?
  created_at, updated_at
```

---

## 5 — Open questions (DATA SHAPE — RESOLVE BEFORE SPEC IS FINAL)

| #       | Question                                                                                                                                                                                             | Why it matters                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Q1**  | **Rabat (discount).** Sheet has a `rabat` column per item (col R = %). Keep as `discount_pct` on `kosztorys_items` or handle elsewhere?                                                              | Affects 4 of the 6 tables potentially (catalogue default vs. per-item override).    |
| **Q2**  | **VAT.** Sheet appears net-only. Need `vat_rate` per item, single net model, or both net + a global gross flag?                                                                                      | If kosztorys is the formal offer to a client, VAT often matters.                    |
| **Q3**  | **Items vs. materials.** `kosztorys_robocizny` is labour. The sheet's `materiały` tab is materials shopping. Unified `kosztorys_items` with `kind: 'labour' \| 'material'` enum, or separate tables? | Touches schema shape AND whether the materiały mirror can/should be retired sooner. |
| **Q4**  | **Soft- vs. hard-delete on `kosztorys_items`.** Soft = audit trail, harder UI. Hard = simpler, no history.                                                                                           | Project so far has been hard-delete; consistency matters.                           |
| **Q5**  | **Currency.** Assuming PLN only. Confirm — any multi-currency need?                                                                                                                                  | If no, drop the question; if yes, every numeric needs currency context.             |
| **Q6**  | **Section / item / stage ordering.** `display_order` int (drag-to-reorder) or alphabetical / by-creation? Sheet uses authored order.                                                                 | UX implication: drag-to-reorder costs more to build.                                |
| **Q7**  | **`rooms` table — really needed in POC?** Sheet's `pokoje` tab is mostly empty in the template. Is the owner actually using it on real jobs?                                                         | If aspirational, drop from POC, add later. Saves a table + UI.                      |
| **Q8**  | **`work_catalogue` seeding.** Hand-type from scratch? Parse inv 6's sheet once to populate? Start empty and let the catalogue grow as the owner uses the editor?                                     | Defines a one-shot script if we parse, or "live without it" UX otherwise.           |
| **Q9**  | **Catalogue per workspace / per user / global?** Current model assumes single shared catalogue across the whole installation. Confirm.                                                               | If multi-tenant ever happens this is a hard FK to refactor.                         |
| **Q10** | **Item-level FK to a room?** Some items are room-scoped ("Łazienka 1 — kafle 25 m²"); some are global ("transport gruzu"). Optional `room_id` FK on `kosztorys_items`, or no link at all in POC?     | Required for any "by-room" report. Probably YAGNI for POC.                          |

---

## 6 — UI shape (sketch — to be expanded in final spec)

### Page: `/inwestycje/[id]/kosztorys`

Becomes a tabbed page (shadcn `Tabs`):

- **Tab "Arkusz"** — existing iframe view (untouched).
- **Tab "Edytor"** — new in-app TanStack Table editor.

### Edytor tab — high-level component shape

```
[Investment header — already exists]

[Toggle group: Pricing view]
  ( ) Klient    ( ) Podwykonawca z narzędziami    ( ) Podwykonawca własne narzędzia

[TanStack Table — virtualised body, section-grouped]
  ┌─────────────────────────────────────────────────────────┐
  │ ▼ Klimatyzacja                            Σ section     │ ← group header
  │   #  Opis           Jedn  Przedm  Pomiar  Cena  …  Σ    │ ← column header
  │   18 montaż klima…  szt   2       2       1200  …  2400 │ ← item
  │   19 rury miedz.    mb    8       10      100   …  1000 │
  │   …                                                     │
  │   [+ Dodaj pozycję]  ← autocomplete from work_catalogue │
  │ ▼ Wyburzenia                              Σ section     │
  │   …                                                     │
  ├─────────────────────────────────────────────────────────┤
  │                              Σ grand total              │ ← footer
  └─────────────────────────────────────────────────────────┘

[Section management]   [Stage management]   [Rooms editor (Q7)]

[Print/PDF export button — printViaIframe]
```

### Columns in the table

| Col            | Source                                        | Editable                 |
| -------------- | --------------------------------------------- | ------------------------ |
| #              | `display_order`                               | drag                     |
| Opis           | `description`                                 | inline text              |
| Jedn.          | `unit`                                        | inline select            |
| Przedmiar      | `planned_qty`                                 | inline number            |
| Pomiar         | `measured_qty`                                | inline number            |
| Cena           | `<current_price_column>` (driven by toggle)   | inline number            |
| Stage 1..N qty | `stage_progress.qty_done` for `(item, stage)` | inline number, blank = 0 |
| Σ row          | `qty × price`                                 | computed (no edit)       |
| Notatka        | `note`                                        | inline text              |
| ⋮ actions      | —                                             | duplicate / delete       |

Section banner row = group header (provided by TanStack `getGroupedRowModel`).
Section + grand totals = `useMemo` reductions on the visible rows.

---

## 7 — Computed values — three layers

1. **Per-row totals** — pure functions in cell render (`item.qty × item[priceCol]`).
   No persistence.
2. **Section / grand totals** — `useMemo` over the row data, or server-side
   SQL `SUM` if rendered statically. No persistence.
3. **Cross-table (plan vs. actual)** — SQL JOIN against `INVESTMENT_EXPENSE`,
   computed on read. Future "Klimatyzacja: budgeted 12 000 zł, spent 9 400 zł"
   dashboards live here.

None of these are stored. That's the lesson Excel hides — every SUMIF was a
denormalisation. In a DB you compute.

---

## 8 — Print / export

- Reuse `buildPrintHtml` + `printViaIframe` from `src/lib/export/` (the
  pattern already used by transfers' Drukuj button).
- New module: `src/lib/export/kosztorys-print.ts` — renders the kosztorys
  shape to print-styled HTML (section banners, stage columns, totals).
- Browser print dialog → user saves as PDF. No `react-pdf`/`jsPDF`
  dependency.

---

## 9 — Reusable infrastructure already in place

| Piece                                 | Where                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| TanStack Table                        | `package.json` (8.21.3), `src/components/ui/data-table/*`                                               |
| Virtualisation                        | `@tanstack/react-virtual` 3.13.18, `virtualized-table-body.tsx`                                         |
| Column definitions pattern            | `src/lib/tables/{users,investments,transfers,cash-registers}.tsx` — kosztorys is a new file in this dir |
| `protectedAction` mutation wrapper    | `src/lib/actions/utils.ts`                                                                              |
| Cache tags / `updateTag` revalidation | `src/lib/cache/*`                                                                                       |
| Optimistic update store               | `useOptimisticFormStore` (Zustand)                                                                      |
| Print → browser PDF                   | `src/lib/export/print.ts` + `print-iframe.ts`                                                           |
| Payload collection scaffolding        | `src/collections/*`                                                                                     |
| Inline form inputs + Zod 4 validation | `src/components/forms/*` with `useAppForm()`                                                            |

The implementation cost is mostly _typing_, not _researching_ — every layer
exists in the codebase already.

---

## 10 — Explicitly out of scope (do NOT build for this PR)

- Bidirectional sync (sheet ↔ in-app editor).
- Importer from existing sheets (inv 6 / inv 31). Existing investments stay
  on the **Arkusz** tab.
- Sheet integration teardown — Phase 3b, separate later PR.
- Schema customisation (JSONB sidecars, EAV, custom columns per investment).
- Multi-currency.
- Multi-tenant catalogues.
- Real-time collaborative editing.
- Item-level room scoping (Q10 — YAGNI for POC).

---

## 11 — Phasing (current best guess)

| Step          | What                                                           | Mergeable separately?       |
| ------------- | -------------------------------------------------------------- | --------------------------- |
| 1             | 6 Payload collections + migration                              | ✅                          |
| 2             | Server actions (CRUD) for items / sections / stages / progress | ✅                          |
| 3             | `src/lib/tables/kosztorys.tsx` column defs                     | ✅ depends on 1, 2          |
| 4             | `/inwestycje/[id]/kosztorys` tabs layout + new editor page     | ✅ depends on 3             |
| 5             | Section + stage management UI                                  | ✅ depends on 4             |
| 6             | Rooms editor (if Q7 = yes)                                     | ✅ optional                 |
| 7             | Catalogue management UI (CRUD over `work_catalogue`)           | ✅ optional, can ship later |
| 8             | Print / PDF export                                             | ✅                          |
| 9             | Catalogue seeding (one-shot script if Q8 = parse)              | ✅ optional                 |
| **Future PR** | Phase 3b — teardown of sheet integration                       | separate PR                 |

---

## 12 — Sheet integration teardown (Phase 3b, future PR — NOT this work)

Documented here so we don't forget what gets cut later:

- `src/lib/google/sheets.ts` — all of it.
- `src/lib/google/drive.ts` — all of it.
- `src/lib/google/sheet-access.ts` — all of it.
- `src/lib/google/auth.ts` — depends if anything else still uses Google APIs.
- `src/lib/actions/sheets-sync.ts` — all of it.
- `src/hooks/transfers/sync-kosztorys-sheet.ts` — wired in `src/collections/transfers.ts`.
- `src/collections/investments.ts` — drop the `googleSheetId` field.
- New migration: drop the unique constraint, drop the column.
- Tests under `src/__tests__/lib/google/` + `src/__tests__/hooks/sync-kosztorys-sheet*`.
- `src/app/(frontend)/inwestycje/[id]/kosztorys/iframe-view.tsx` — drop, plus the **Arkusz** tab.
- `setupKosztorysSheetAction`, `linkKosztorysSheetAction`, `provisionKosztorysAction` — drop.
- `[id]/kosztorys/sync-button.tsx` — drop.
- Env vars to remove: `KOSZTORYS_TEMPLATE_SHEET_ID`, `KOSZTORYS_DRIVE_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` (if no other consumer).
- Docs to retire: `docs/kosztorys-sync.md` (or rewrite as historical note).

Trigger: no active investment still uses the Arkusz tab.

---

## 13 — Next steps after the break

1. **Resolve Q1–Q10.** Data shape is the load-bearing decision.
2. **Lock the schema** — convert §4 into the final shape, drop the "UNDER DISCUSSION" banner.
3. **Promote this doc** from DRAFT to spec. Remove the "do not implement from this" warning.
4. **Hand off to writing-plans** to break the work into atomic implementation milestones.
5. **Open one PR per phase step** (§11) — keep diffs small.

---

## Session artefacts

- This doc — `docs/superpowers/specs/2026-05-28-kosztorys-in-app-editor-design.md`
- Inspection tooling — `docs/kosztorys-sheet-inspection.md` (run command + script)
- Inspection script — `scripts/inspect-template.mjs` (delete once design is locked)
- Current sheet sync (untouched by this work) — `docs/kosztorys-sync.md`
