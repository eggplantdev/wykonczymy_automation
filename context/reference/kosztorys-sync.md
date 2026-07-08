# Kosztorys ↔ Google Sheets (legacy sync)

> **Legacy sync for pre-cutover investments** — kept live for every investment still on a
> sheet, but on death row: new investments go to the in-app editor (roadmap **S-09** cutover),
> and existing sheets only stay read-accessible afterward (FR-016). No new feature work lands
> here — bugfixes during the transition only. **Operational pointer, not a design of record.**
> The current frozen-column contract lives in `context/foundation/lessons.md` — trust it, not
> this file. The go-forward in-app editor is tracked in `context/foundation/roadmap.md` (S-01+);
> its decision register is `context/changes/kosztorys-poc-in-app/change.md` on branch
> `poc-kosztorys-in-app`.

## What it is

Postgres is the source of truth; the Google Sheet is a **materialised view** of an
investment's costs — same idea as a CQRS read model (normalised source, denormalised view for
an owner working in Sheets). Writes flow **one way** (app → sheet). The app never reads sheet
edits back. This mirror was always **transitional** — a bridge between the sheet-kosztorys world
and the app-actuals world; once the kosztorys itself lives in the app (roadmap S-01+), the bridge
has no shore to connect to, so the S-09 cutover retiring it is _completing the transition_, not
cleanup. The owner opens the sheet in an iframe at `/inwestycje/[id]/kosztorys`; a top-level
`/kosztorysy` page lists every kosztorys and links unlinked ones to investments.

A kosztorys is its own collection (`kosztoryses`, slug unchanged), joined 1:1 to `investments`
via a nullable FK (`ON DELETE SET NULL` + partial unique index) so it can exist before its
investment and outlive it.

## Live model — three app-managed tabs

The app stamps a **registry of three tabs** (not the single tab this doc used to describe),
`APP_MANAGED_TABS` in `src/lib/google/app-managed-tabs.ts`, in stamp order:

1. **expenses** (`EXPENSES_TAB_CONFIG`) — active (non-cancelled) `INVESTMENT_EXPENSE` rows.
2. **settled R+M** (`SETTLED_TAB_CONFIG`) — the `settled` robocizna+materiały rows.
3. **transfers** (`TRANSFERS_TAB_CONFIG`).

`stampAllTabs(spreadsheetId, payload, mode)` is the single entry point: `'setup'` = destructive
rebuild (reset button), `'ensure'` = create-if-missing (link / add). Adding a tab is one registry
entry, not a hand-unrolled call per path.

Per-tab behaviour that still holds:

- **Active-costs mirror, not append-only.** Cancel → row deleted (no reversing row); edit →
  overwritten in place; `RAZEM`/per-type SUMIF totals always equal the app's live totals.
- **Columns are header-driven, not positional** — the resolver scans for a header carrying all
  mapped fields, keyed on the `id` column (Postgres tx id), and **fails loud** on a missing /
  ambiguous header. The owner may reorder columns.
- **Tab is protected** (`addProtectedRange`, service-account editor). Inherent gap: Google lets
  the **file owner** bypass protection — unclosable without transferring sheet ownership to the SA.
- Writes fire from a **Payload collection hook** (`src/hooks/transfers/sync-sheet.ts`) via
  `after()`, so admin-panel and bare-`payload.*` edits sync too. This is the **documented
  exception** to "side effects go in the server action". Bulk creates defer via
  `req.context.skipSheetSync` and batch once per investment.
- A manual **Synchronizuj** button reconciles drift (append missing + heal present + scoped
  orphan-removal — only removes ids resolving to _this_ investment's own expenses).

## Provisioning

Three entry points, two underlying ops — **copy the template** (`drive.files.copy`, currently
blocked on the personal-account SA's missing Drive quota — see memory
`project_kosztorys_sa_no_drive_storage`) or **link an existing owner-shared sheet** (the working
path today). The `/kosztorysy` listing page also registers unlinked kosztorysy for costing a
project before its investment exists.

## Deliberately not built

Outbox table, Sheets→app webhook, and a cron reconciler were all rejected — the manual
Synchronizuj button covers the same gap with no extra schema, and sheets are low-traffic.

## Key files

```
src/lib/google/app-managed-tabs.ts   ← the 3-tab registry + stampAllTabs (create/reset plane)
src/lib/google/sheets.ts             ← tab configs + setup/ensure primitives
src/lib/google/tab-rows.ts           ← row shaping per tab (incl. settled R+M)
src/lib/google/sheet-configs.ts / sheet-format.ts / sheet-summary.ts  ← config, formatting, SUMIF summary
src/lib/google/expense-categories.ts ← category names feeding the summary keys
src/lib/google/sheet-access.ts       ← link/verify an existing sheet
src/lib/google/sheet-lookup.ts       ← getInvestmentSheetId (kosztoryses → sheetId)
src/lib/google/drive.ts / auth.ts    ← Drive copy + service-account JWT
src/hooks/transfers/sync-sheet.ts    ← collection-hook sync trigger
src/lib/actions/sheets-sync.ts       ← preview / apply (server re-derive)
src/lib/actions/sheets.ts            ← unlinked add / link-to-investment / unlink / delete
src/app/(frontend)/kosztorysy/page.tsx                  ← listing page
src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx   ← per-investment iframe
```

The full finding ledger from the PR13 review (accepted residuals, won't-fixes) lives at
`context/reference/plans/2026-05-27-kosztorys-pr13-simplify-review.md`.
