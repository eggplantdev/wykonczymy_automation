# Kosztorys ↔ Google Sheets (legacy sync)

> **Live production code, not a dying branch (owner, 2026-09-15).** „Legacy" here names the
> _era_ this sync serves, never its support level: every client still on an old Google sheet is
> served by it, and that is expected to hold **for a long time**. The two worlds — sheet-integrated
> and app-only — run **side by side** for an indefinite period, so this is not on death row and
> there is no date on it. Judge a change here on its merits like any other production code; the
> earlier „no new feature work, bugfixes only" rule is withdrawn, as is the matching test exclusion
> (`context/foundation/test-plan.md` §7, overturned the same day).
>
> New investments do go to the in-app editor — roadmap **S-19** cutover, reached 2026-08-25 — but
> the cutover only stopped _new_ sheets appearing; it retired nothing that already exists, and
> existing sheets stay fully readable (FR-016).
>
> **Danger, and the reason this doc is operational.** Every non-production database is a restored
> prod dump, so localhost, Preview and the E2E DB all carry **live sheet ids** — that is how eight
> sheets took 36 foreign rows in 2026-08. Writes are gated by the _credential_, not a flag: only
> Vercel Production holds `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON`. Read `AGENTS.md` („Google Sheets: two
> service accounts") and `context/reference/outgoing-effects-isolation.md` before touching any write
> path here.
>
> **Operational pointer, not a design of record.** The current frozen-column contract lives in
> `context/foundation/lessons.md` — trust it, not this file. The go-forward in-app editor is tracked
> in `context/foundation/roadmap.md` (S-01+); its raw POC docs are archived at
> `context/archive/kosztorys-poc-in-app/`.

## What it is

Postgres is the source of truth; the Google Sheet is a **materialised view** of an
investment's costs — same idea as a CQRS read model (normalised source, denormalised view for
an owner working in Sheets). Writes flow **one way** (app → sheet). The app never reads sheet
edits back. This mirror was **conceived as transitional** — a bridge between the sheet-kosztorys
world and the app-actuals world — but it outlived that framing: the in-app editor (roadmap S-01+)
gave new investments somewhere else to go without taking the far shore away, so the bridge keeps
carrying every client who is still on a sheet. It gets retired when the last such client is
migrated, and nothing schedules that. The owner opens the sheet in an iframe at `/inwestycje/[id]/kosztorys`; a top-level
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

The full finding ledger from the PR13 review (accepted residuals, won't-fixes) was
`docs/plans/2026-05-27-kosztorys-pr13-simplify-review.md`, deleted in `47608a8a` — recover it from
git history if a residual ever needs re-reading.
