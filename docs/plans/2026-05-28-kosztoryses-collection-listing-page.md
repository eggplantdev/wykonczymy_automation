# Kosztorysy Listing Page + Unlinked Kosztorys Support — Implementation Plan

> **Status: 2026-05-28.** Approved. Tracks the refactor that moves
> `googleSheetId` off `investments` into a new `kosztoryses` collection so a
> kosztorys can exist before its investment does. Branch `table`.

---

## Context

A kosztorys today is an attribute of an investment: `investments.google_sheet_id`
(nullable text + unique index). You can only register a sheet when an investment
row already exists. The old top-level `/kosztorysy` listing page (removed in
`b4bef19`) just listed investments, so it offered nothing the investments table
didn't.

The new workflow: **register a kosztorys before the investment exists**, then
attach it to an investment once the investment is created. Typical use: planning/
costing a project before committing to it.

Selected data model: **the new `kosztoryses` collection owns `google_sheet_id`**
with an optional `investment` FK; `investments.google_sheet_id` is removed.
Single source of truth; sync code re-routes through the new lookup.

---

## Data model

New collection `kosztoryses` (Payload slug → DB table is pluralize-then-snake_case;
`expense-categories` → `expense_categories` confirms the pattern, so
`kosztoryses` → `kosztoryses` literal).

Fields:

- `googleSheetId` — text, **unique**, required
- `name` — text, required (defaulted at create-time to the sheet's title via
  `verifySheetAccess`)
- `investment` — relationship to `investments`, nullable, `hasMany: false`
- Auto: `id`, `createdAt`, `updatedAt`

DB constraints:

- `google_sheet_id varchar UNIQUE NOT NULL` — Payload's `unique: true` emits this.
- `investment_id integer REFERENCES investments(id) ON DELETE SET NULL` —
  kosztorys outlives its investment, becoming unlinked when the investment is
  deleted.
- **Partial unique index** on `investment_id WHERE investment_id IS NOT NULL` —
  Payload doesn't ship native partial-unique; hand-written in the migration.
  Without it, two kosztoryses could share one investment.

Access (`src/access/index.ts` patterns):

- `read` / `create` / `update`: `isAdminOrOwnerOrManager`
- `delete`: `isAdminOrOwner` (matches `src/collections/investments.ts:29` —
  destructive ops kept tighter).

Admin: `useAsTitle: 'name'`, `defaultColumns: ['name', 'investment', 'googleSheetId']`,
`group: 'Finance'`.

Hooks: `afterChange` / `afterDelete` revalidate via the existing
`makeRevalidateAfterChange` / `makeRevalidateAfterDelete` helpers (the pattern
expense-categories uses).

Cache tag: add `kosztoryses: 'collection:kosztoryses'` to `src/lib/cache/tags.ts`.

---

## Migration `20260528_move_sheet_id_to_kosztoryses`

Hand-written (NOT `migrate:create` — see memory
`project_migrate_create_stale_snapshots`). Runs in order:

1. `CREATE TABLE kosztoryses (id serial PRIMARY KEY, google_sheet_id varchar
UNIQUE NOT NULL, name varchar NOT NULL, investment_id integer REFERENCES
investments(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT
NOW(), updated_at timestamptz NOT NULL DEFAULT NOW())`.
2. `CREATE UNIQUE INDEX kosztoryses_investment_id_unique_idx ON kosztoryses
(investment_id) WHERE investment_id IS NOT NULL` — the partial unique
   constraint.
3. Backfill: `INSERT INTO kosztoryses (google_sheet_id, name, investment_id,
created_at, updated_at) SELECT google_sheet_id, name, id, NOW(), NOW() FROM
investments WHERE google_sheet_id IS NOT NULL`.
4. `DROP INDEX IF EXISTS investments_google_sheet_id_idx` (from
   `20260527_add_unique_google_sheet_id`).
5. `ALTER TABLE investments DROP COLUMN google_sheet_id`.
6. Register the kosztoryses row in `payload_locked_documents_rels` (follow
   `src/migrations/20260211_212425.ts:4-85` for the locked-documents pattern,
   otherwise admin-panel locking fails).

Down migration reverses: re-adds investments.google_sheet_id, copies values back
from kosztoryses, drops kosztoryses + its indexes.

Register in `src/migrations/index.ts`. Prior two migrations
(`20260525_add_google_sheet_id_to_investments`, `20260527_add_unique_google_sheet_id`)
stay in history — they ran on test-db and shouldn't be retroactively unmade.

---

## Refactor surface — sync layer

**Central change (1 function, 6 call sites all in sheets-sync.ts):**

`src/lib/actions/sheets-sync.ts:129-139` — `getInvestmentSheetId(payload,
investmentId)` today does `payload.findByID('investments', id).googleSheetId`.
Refactor to query `kosztoryses` by relationship:

```ts
const found = await payload.find({
  collection: 'kosztoryses',
  where: { investment: { equals: investmentId } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
return found.docs[0]?.googleSheetId ?? undefined
```

All six callers (lines 143, 212, 248, 288, 299, 366) keep their signatures
unchanged — the indirection is hidden behind this one function. No other site
in `sheets-sync.ts` reads `googleSheetId` directly.

**Test mocks (`src/__tests__/lib/actions/sheets-sync.test.ts`, ~18 sites):**

Today: `findByIDMock.mockResolvedValue({ id: 31, name: '…', googleSheetId: 'sheet-1' })`.

After: a new helper that mocks the kosztoryses lookup —

```ts
function withSheet(investmentId: number, googleSheetId: string | null) {
  findMock.mockResolvedValueOnce({
    docs: googleSheetId ? [{ id: 1, googleSheetId, investment: investmentId }] : [],
  })
}
```

Apply at every mock site. The investmentId mock value stays where it was.

---

## Refactor surface — write/link/provision actions

`src/lib/actions/investments.ts`:

- **`createInvestmentAction:62-67`** — the fire-and-forget Drive provisioning
  currently `payload.update('investments', { googleSheetId })`. Change to
  `payload.create('kosztoryses', { googleSheetId: sheetId, name: created.name,
investment: created.id })`.
- **`provisionKosztorysAction:123-130`** — same pattern, but for the manual
  button. Same change: create a kosztoryses row instead, with `investment` set.
- **`linkKosztorysSheetAction:159-219`**:
  - Line 171's `if (investment.googleSheetId)` guard → check whether this
    investment already has a kosztoryses row via `payload.find({ collection:
'kosztoryses', where: { investment: { equals: investmentId } } })`.
  - Line 187's duplicate-check `where: { and: [{ googleSheetId: { equals:
sheetId } }, { id: { not_equals: investmentId } }] }` → query `kosztoryses`
    by `googleSheetId` and reject if it exists (the unique index would block it
    too, but we reject loud).
  - Line 213's write → `payload.create('kosztoryses', …)`.
- **`setupKosztorysSheetAction:23-29`** — `if (!investment?.googleSheetId)`
  guard → resolve sheetId via `getInvestmentSheetId` (re-exported from
  sheets-sync.ts or pulled into a shared `src/lib/google/kosztorys-lookup.ts`).

---

## Refactor surface — read/display layer

- **`src/lib/queries/reference-data.ts:42-72`** — the SQL query selects
  `google_sheet_id` from investments and maps it to `hasSheet` (line 102).
  Update:
  - SELECT no longer reads `google_sheet_id`.
  - Add `LEFT JOIN kosztoryses k ON k.investment_id = i.id` and `k.google_sheet_id
IS NOT NULL AS has_sheet` in the projection.
  - Mapping: `hasSheet: Boolean(row.has_sheet)`.
- **`src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx:17,34`** —
  `investment.googleSheetId` is gone from the type. Resolve via
  `getInvestmentSheetId(payload, investmentId)` (the same helper sync uses) and
  pass it to `KosztorysIframeView`.
- **`src/collections/investments.ts:77-89`** — DELETE the `googleSheetId` field
  entry.
- After regenerating types (`pnpm generate:types`), `src/payload-types.ts:189,
448` lose `googleSheetId` automatically.

UI components that read `hasSheet` (NOT `googleSheetId`) need no changes — they
consume the derived boolean from reference-data:
`src/lib/tables/investments.tsx:29,110-118`,
`src/components/dialogs/kosztorys-button.tsx`,
`src/app/(frontend)/inwestycje/[id]/page.tsx:78`.

---

## New code — listing page + dialogs

### `/kosztorysy` route — `src/app/(frontend)/kosztorysy/page.tsx`

Three sections, each rendered as a list of cards:

1. **Powiązane kosztorysy** — kosztoryses with `investment` set. Each row:
   investment name, kosztorys name, badges, "Otwórz" link to
   `/inwestycje/{investmentId}/kosztorys`, "Otwórz w Sheets ↗".
2. **Niepowiązane kosztorysy** — kosztoryses with `investment IS NULL`. Each
   row: kosztorys name, "Otwórz w Sheets ↗", **"Powiąż z inwestycją"** CTA →
   opens `LinkKosztorysToInvestmentDialog`.
3. **Inwestycje bez kosztorysu** — investments where `hasSheet=false`. Each row:
   investment name, "Dodaj kosztorys" CTA → opens existing `KosztorysSetupDialog`
   (scoped to that investment).

Header CTA: **"+ Dodaj kosztorys"** → opens `AddKosztorysDialog` (creates an
unlinked kosztorys).

Role-gated to MANAGEMENT_ROLES (matches the previous page's
`requireAuth(ADMIN_OR_OWNER_MANAGER_ROLES)`).

Data fetched via a new server query `src/lib/queries/kosztoryses.ts`
(`unstable_cache` with the new `kosztoryses` tag).

### `src/components/dialogs/add-kosztorys-dialog.tsx` (NEW)

A trimmed clone of `KosztorysSetupDialog`'s "Powiąż istniejący arkusz" tab —
but with no investmentId. User pastes URL/id + (optional) name; action
verifies SA access via `verifySheetAccess`, creates the kosztoryses row, runs
`setupMaterialyTab` to stamp the banner / header / summary / protection.

### `src/components/dialogs/link-kosztorys-to-investment-dialog.tsx` (NEW)

Dialog: a select of unlinked investments (`hasSheet=false`) + confirm button.
Calls `linkKosztorysToInvestmentAction(kosztorysId, investmentId)`, which sets
`investment` on the kosztoryses row and triggers a sync to populate the sheet
with the investment's expenses.

---

## New code — actions `src/lib/actions/kosztoryses.ts`

- `addUnlinkedKosztorysAction(input: string, name?: string)` — paste URL →
  `extractSheetId` → `verifySheetAccess` → create kosztoryses row (no
  investment) → `setupMaterialyTab`. Returns `{ kosztorysId, name }`.
  `protectedAction` with `['kosztoryses']` revalidation.
- `linkKosztorysToInvestmentAction(kosztorysId: number, investmentId: number)`
  — guard that this investment doesn't already have a kosztorys (partial unique
  constraint would catch it, but we reject loud with a Polish error). Set
  `investment` on the kosztoryses row. Trigger `applyMaterialSync(investmentId)`
  to populate the sheet. `protectedAction` with
  `['kosztoryses', 'investments']` revalidation.
- `unlinkKosztorysFromInvestmentAction(kosztorysId: number)` — clears
  `investment`. The sheet stays as-is (we don't delete data; user can re-link
  later). Revalidate both tags.
- `deleteKosztorysAction(kosztorysId: number)` — deletes the row only (does NOT
  touch the Sheet). Revalidate both tags. Restricted to `MANAGEMENT_ROLES`
  (matches the `delete` access on the collection at the Payload level).

---

## Sidebar + state doc

- `src/components/nav/sidebar.tsx` + `src/lib/constants/sections.ts` — add a
  top-level "Kosztorysy" entry pointing at `/kosztorysy`. Same role gate
  (MANAGEMENT_ROLES).
- `docs/kosztorys-sync.md` — extend the "Provisioning" section + add a new
  "Data model" section documenting the kosztoryses collection, the unlinked
  workflow, the partial unique index, and the migration trail.

---

## Verification

End-to-end manual (Playwright, against test-db + the test sheet on inv 6):

1. Navigate to `/kosztorysy` — see all three sections populated.
2. Click "+ Dodaj kosztorys" — paste a URL of a sheet shared with the SA (not
   yet linked) → kosztorys appears in "Niepowiązane".
3. Click "Powiąż z inwestycją" on the unlinked kosztorys → pick a no-sheet
   investment → confirm. Verify: row moves to "Powiązane" section; the sheet's
   materiały tab gets the banner + the investment's expenses.
4. Re-confirm the existing flows still work: create-investment auto-provision
   (still fails on personal SA — banner appears), `linkKosztorysSheetAction`
   from the investment detail page, reset/sync on inv 6.
5. Verify `investments.google_sheet_id` column is gone
   (`docker exec wykonczymy psql -d wykonczymy-test-db -c "\d investments"`).
6. Verify the partial unique index exists (`\d kosztoryses`).

Automated:

- `pnpm typecheck` — must pass after `pnpm generate:types`.
- `pnpm test` — sheets-sync test mocks updated to the new lookup shape; should
  pass.
- New `src/__tests__/lib/actions/kosztoryses.test.ts` — covers happy path +
  duplicate-link rejection + cascade on investment delete.

---

## Milestones (atomic; one commit each)

1. **Data model**: new collection + cache tag + migration + register; run
   `pnpm migrate`. (4 files)
2. **Sync layer**: refactor `getInvestmentSheetId` + update its sheets-sync test
   mocks. (2 files)
3. **Write actions**: refactor investments.ts (create / provision / link /
   setup) + any tests they have. (1 file + tests)
4. **Read/display**: reference-data SQL + the per-investment kosztorys page +
   remove the field from `investments.ts` + regen types + delete usages of
   `googleSheetId`. (4 files + auto-gen)
5. **Listing page + new actions + dialogs**: `/kosztorysy/page.tsx`, queries,
   dialogs, kosztoryses actions, sidebar. (~7 files)
6. **Docs**: update `docs/kosztorys-sync.md`. (1 file)

Suite + typecheck after each milestone.

---

## Post-implementation

1. **Run the `simplify` skill** against the diff (`git diff @{upstream}...HEAD`)
   before final commit; fix or document each finding.
2. **Playwright live-verify** the verification steps above.

---

## Out of scope (deferred)

- A "pick from existing unlinked kosztoryses" tab inside the existing
  `KosztorysSetupDialog` on the investment detail page. The listing page's
  "Powiąż z inwestycją" CTA covers the workflow; adding it to the dialog is
  incremental polish.
- T1.5 namespacing revisit (technical blocker is gone since Tables are
  stripped, but the user-decided won't-fix still holds).
- The test-db → prod cutover (orthogonal; tracked in `docs/kosztorys-sync.md`
  Open work).
- Sheets → app webhook (still rejected).
