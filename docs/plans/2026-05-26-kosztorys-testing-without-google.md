# Kosztorys Testing Plan — Without Google API

> Validates Tasks 4–9 from `docs/plans/2026-05-20-kosztorys-b-iframe-poc-build.md`
> on a fresh local DB, with dummy Google credentials. Real-Google E2E is the
> build plan's Task 10 — gated by separate Google Cloud setup.

**Goal:** Smoke-test the new sync code (DB column, server actions, UI, banner,
iframe page) without provisioning a real service account.

**What we accept:**

- **The "Utwórz nowy kosztorys" banner button and the sync button will show
  error toasts when clicked** — those paths `await` Google and we have no
  real creds. The button rendering + click handler is verifiable; the
  success path is deferred to real-Google testing.
- **The iframe page chrome renders but the iframe content itself shows
  Google's "no access" page** — the URL points to a fake sheet ID. That's
  fine; we're checking that the route resolves and the chrome composes
  correctly, not that Google honours the URL.
- **Fire-and-forget paths fail silently as designed** — for transfer
  create/cancel and investment create, the user-visible action succeeds and
  the server log records the failed sync attempt with `[sheets-sync]
failed (non-fatal):`. The log line itself is the proof that the wiring
  is correct.

**What we explicitly do NOT need:**

- A Google Cloud project / service account / template sheet / Drive sharing

---

## Prerequisites

- [ ] Docker Postgres 17 container `wykonczymy` running on port 5433
      (`docker compose up -d`)
- [ ] `psql` available locally (or use `docker exec` — see Phase 1)
- [ ] A recent dump in `dumps/` (the project's `db:dump` script already
      produces `dumps/dump-latest.sql`). If you want a guaranteed-current
      dump, switch to `main` and run `pnpm db:dump`, then come back to
      `table`.

---

## Phase 1: Fresh side-by-side database from dump

We create a **new database inside the existing `wykonczymy` container** so
your normal local DB (`wykonczymy-db`) stays untouched. You switch
between the two by flipping `DB_POSTGRES_URL` in `.env`.

The dump was created with `pg_dump --clean --no-owner --no-acl`, so its
`DROP TABLE` statements run against the _target_ DB only — they cannot
touch other databases in the same container.

- [ ] **Step 1:** Create the new database:

  ```bash
  docker exec -i wykonczymy psql -U postgres -c 'CREATE DATABASE "wykonczymy-test-db";'
  ```

  Expect: `CREATE DATABASE`. If it already exists from a previous run,
  drop it first: `DROP DATABASE "wykonczymy-test-db";` (only ever runs
  against the side-by-side DB — never `wykonczymy-db`).

- [ ] **Step 2:** Restore the latest dump _into the new DB_:

  ```bash
  docker exec -i wykonczymy psql -U postgres -d 'wykonczymy-test-db' < dumps/dump-latest.sql
  ```

  Expect: lots of `DROP TABLE` + `CREATE TABLE` + `INSERT` chatter; final
  line clean. The `DROP`s target tables inside `wykonczymy-test-db` only.

- [ ] **Step 3:** Confirm the DB is loaded but our new column doesn't yet
      exist (the migration hasn't run):

  ```bash
  docker exec -i wykonczymy psql -U postgres -d 'wykonczymy-test-db' \
    -c "\d investments" | grep -i google || echo "no google column yet — expected"
  ```

  Expect: `no google column yet — expected`. (The dump is from before the
  Task 4 migration; the migration will run on dev boot in Phase 2.)

- [ ] **Step 4:** Confirm the original DB is untouched:

  ```bash
  docker exec -i wykonczymy psql -U postgres -c '\l' | grep wykonczymy
  ```

  Expect: both `wykonczymy-db` and `wykonczymy-test-db` listed.

- [ ] **Step 5:** Note investment IDs you'll use for testing:

  ```bash
  docker exec -i wykonczymy psql -U postgres -d 'wykonczymy-test-db' \
    -c "SELECT id, name, status FROM investments ORDER BY id LIMIT 10;"
  ```

  Pick at least one investment for the unlinked-banner tests. If id 31
  exists, use it (matches the build plan's working example).

---

## Phase 2: Point the app at the test DB + boot with dummy Google env

Files: `.env`

- [ ] **Step 1:** Comment out the current `DB_POSTGRES_URL` and add a
      test-DB line above it (so you can flip back by toggling comments).
      The URL points at `wykonczymy-test-db` instead of `wykonczymy-db`:

  ```
  # DB_POSTGRES_URL=<original wykonczymy-db URL>  ← comment this
  DB_POSTGRES_URL=postgres://postgres:<password>@127.0.0.1:5433/wykonczymy-test-db
  ```

  Keep `POSTGRES_PASSWORD` as is — only the database segment of the URL
  changes.

- [ ] **Step 2:** Add three Google dummy vars to `.env` (the validator
      parses `GOOGLE_SERVICE_ACCOUNT_JSON` and requires `client_email` +
      `private_key`):

  ```
  GOOGLE_SERVICE_ACCOUNT_JSON='{"client_email":"test@example.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----\nFAKE_KEY_FOR_LOCAL_TESTING\n-----END PRIVATE KEY-----\n"}'
  KOSZTORYS_TEMPLATE_SHEET_ID='fake-template-id-local-testing'
  ```

  Single quotes are mandatory — zsh would otherwise eat the `\n` in
  `private_key`.

- [ ] **Step 3:** Boot dev:

  ```bash
  pnpm dev
  ```

  Expect:
  - No env validation errors at startup
  - Migration log includes `20260525_add_google_sheet_id_to_investments`
    (running against `wykonczymy-test-db`, not the real DB)
  - "Ready" appears

- [ ] **Step 4:** Confirm the column landed _in the test DB only_:

  ```bash
  docker exec -i wykonczymy psql -U postgres -d 'wykonczymy-test-db' \
    -c "\d investments" | grep google
  ```

  Expect: `google_sheet_id | character varying`.

  And confirm the original DB is **still** untouched:

  ```bash
  docker exec -i wykonczymy psql -U postgres -d 'wykonczymy-db' \
    -c "\d investments" | grep -i google || echo "wykonczymy-db unaffected — expected"
  ```

---

## Phase 3: Vitest coverage for sheets-sync

Files: `src/__tests__/lib/actions/sheets-sync.test.ts` (new)

The existing test suite covers `sheets.ts` and `drive.ts` (low-level
clients). The reconciler diff logic in `sheets-sync.ts` is the densest
new code and has no coverage yet.

- [ ] **Step 1:** Create the test file. Mock `googleapis`, `payload`, and
      `requireAuth`. Pattern lifts from
      `src/__tests__/lib/google/sheets.test.ts`.

  Skeleton:

  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest'

  const valuesGetMock = vi.fn()
  const findMock = vi.fn()
  const findByIDMock = vi.fn()

  vi.mock('googleapis', () => ({
    google: {
      auth: {
        JWT: vi.fn().mockImplementation(function (this: object) {
          return this
        }),
      },
      sheets: vi.fn().mockReturnValue({
        spreadsheets: {
          get: vi.fn(),
          batchUpdate: vi.fn(),
          values: { append: vi.fn(), update: vi.fn(), get: valuesGetMock },
        },
      }),
    },
  }))

  vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
      find: findMock,
      findByID: findByIDMock,
    }),
  }))

  vi.mock('@/lib/auth/require-auth', () => ({
    requireAuth: vi.fn().mockResolvedValue({
      success: true,
      user: { id: 1, role: 'OWNER' },
    }),
  }))

  vi.mock('@/lib/cache/revalidate', () => ({
    revalidateCollections: vi.fn(),
  }))

  beforeEach(() => {
    valuesGetMock.mockReset()
    findMock.mockReset()
    findByIDMock.mockReset()
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: 'test@x.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n',
    })
  })
  ```

- [ ] **Step 2:** Write these test cases (concrete, not exhaustive):

  | Case                                                                 | Setup                                                                                       | Assert                                              |
  | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
  | `previewMaterialSync` rejects when investment has no `googleSheetId` | `findByIDMock` returns investment with `googleSheetId: null`                                | `result.success === false`, error message in Polish |
  | `previewMaterialSync` returns `toAppend` for DB rows not in sheet    | DB returns 2 Materiały transactions; sheet col I returns empty                              | `data.toAppend.length === 2`                        |
  | `previewMaterialSync` returns `toDelete` for cancelled rows in sheet | DB returns the cancelled transaction (probe finds it); sheet col I contains that transferId | `data.toDelete.length === 1`, `data.toAppend = []`  |
  | `previewMaterialSync` classifies true orphans                        | Sheet col I contains transferId 9999; `findByID(9999)` returns null                         | `data.orphans[0].transferIdInSheet === 9999`        |
  | `applyMaterialSync` skips append when row already present in col I   | `preview.toAppend = [{transferId: 5, …}]`; col I currently `[5]`                            | `data.added === 0`, `data.skipped === 1`            |
  | `applyMaterialSync` refuses if spreadsheetId mismatch                | preview's `spreadsheetId` ≠ investment's current `googleSheetId`                            | `result.success === false`                          |

- [ ] **Step 3:** Run:

  ```bash
  pnpm test -- src/__tests__/lib/actions/sheets-sync.test.ts
  ```

  All green.

- [ ] **Step 4:** Run the full suite to confirm no regression:

  ```bash
  pnpm test
  ```

---

## Phase 4: Manual UI walkthrough

Dev server running with the dummy env. Open two browser tabs — admin
(`/admin`) and frontend (`/`).

### Scenario 1: Payload admin field

- [ ] Admin → Investments → pick any row.
- [ ] Expect: **"ID arkusza Google"** field visible (Polish label),
      currently empty.
- [ ] Paste any string, Save.
- [ ] Verify in DB:

  ```bash
  docker exec -i wykonczymy psql -U postgres -d 'wykonczymy-db' \
    -c "SELECT google_sheet_id FROM investments WHERE id = X;"
  ```

  Expect: your value.

- [ ] Clear it back to empty for Scenario 2.

### Scenario 2: No-sheet banner

- [ ] Visit `/inwestycje/{id}` for an investment whose `google_sheet_id`
      is NULL.
- [ ] Expect: amber banner at top:
      "Inwestycja **{name}** nie ma jeszcze powiązanego kosztorysu."
      with two buttons.
- [ ] Click **"Powiąż istniejący arkusz"** → admin opens at the
      investment edit page. ✅
- [ ] Click **"Utwórz nowy kosztorys"** → toast error (expected). ❌
- [ ] Verify in server log: `[ACTION_ERROR] provisionKosztorysAction`
      with a googleapis auth error.

### Scenario 3: Banner disappears after link

- [ ] In admin, set `google_sheet_id = 'manually-set-id'` for that
      investment.
- [ ] Reload `/inwestycje/{id}` → banner gone. ✅

### Scenario 4: Kosztorys iframe page

- [ ] Visit `/inwestycje/{id}/kosztorys` for the now-linked investment.
- [ ] Expect chrome:
  - `"Kosztorys — {name}"` header
  - `"Google Sheets · inwestycja #{id}"` subtitle
  - **"Sprawdź synchronizację"** button (right side)
  - **"Otwórz w Sheets ↗"** link
- [ ] Iframe body: Google's "no access" page. Expected — URL is fake.
- [ ] Click "Sprawdź synchronizację" → toast error (preview API fails on
      dummy creds). ❌
- [ ] Visit `/inwestycje/{id}/kosztorys` for an investment WITHOUT
      `google_sheet_id` → banner above (Scenario 2), page body empty. ✅

### Scenario 5: Transfer auto-push (Materiały, fire-and-forget)

- [ ] Pick the linked investment from Scenarios 3–4.
- [ ] Dashboard → Dodaj wydatek → Wydatek inwestycyjny.
- [ ] Fill: Inwestycja = that one, any active kasa, kwota 100, opis
      "test sync", Typ = **Materiały budowlane**. Submit.
- [ ] Expect:
  - UI success toast, transfer appears in list ✅
  - Server log: `[sheets-sync] failed (non-fatal):` (proves the sync was
    attempted) ✅
- [ ] Open the new transfer's row → Cancel it.
- [ ] Expect: UI success, server log again shows the DELETE-intent
      attempt + failure.

### Scenario 6: Transfer auto-push (non-Materiały, no sync attempted)

- [ ] Create another INVESTMENT_EXPENSE with a non-Materiały category
      (e.g. Robocizna).
- [ ] Expect:
  - UI success ✅
  - **No `[sheets-sync]` log line** — the function returns silently
    because `kind` is undefined for that category. (Negative assertion;
    grep the log if you want to be sure.)

### Scenario 7: Investment auto-provision (fire-and-forget)

- [ ] Create a new investment via the app (or admin).
- [ ] Expect:
  - Investment created, appears in list ✅
  - Server log: `[kosztorys-provision] investment #N failed
(non-fatal):` (Drive rejects fake creds) ✅
- [ ] Visit `/inwestycje/{new-id}/kosztorys` → banner shows (provision
      failed → no `google_sheet_id`). ✅

### Scenario 8: Bulk transfer auto-push

- [ ] Create a bulk Wydatek with at least 3 line items, mixing
      Materiały and non-Materiały categories, on a linked investment.
- [ ] Expect: one `[sheets-sync]` log line per Materiały row; the
      non-Materiały rows produce no log. UI shows one success toast for
      the bulk submit.

---

## Phase 5: Cleanup before real Google

When you're ready to wire real Google credentials:

- [ ] **Flip `.env` back to `wykonczymy-db`** — uncomment the original
      `DB_POSTGRES_URL`, comment / delete the `wykonczymy-test-db` line.
- [ ] **Drop the test database** (only ever target the test DB here, not
      `wykonczymy-db`):

  ```bash
  docker exec -i wykonczymy psql -U postgres -c 'DROP DATABASE "wykonczymy-test-db";'
  ```

- [ ] Remove the dummy Google values from `.env`.
- [ ] Paste real `GOOGLE_SERVICE_ACCOUNT_JSON`,
      `KOSZTORYS_TEMPLATE_SHEET_ID`, and optionally
      `KOSZTORYS_DRIVE_FOLDER_ID`.
- [ ] **Remove the "Temporary: kosztorys testing DB" section from
      `CLAUDE.md`** — it was only there for the duration of this
      testing phase.
- [ ] Restart dev — pointing back at `wykonczymy-db`. The migration
      will run there now, applying the `googleSheetId` column.
- [ ] All the buttons that failed in Scenarios 2, 4 now succeed; the
      log lines in Scenarios 5, 7 flip from "failed (non-fatal)" to
      success messages.
- [ ] At that point, follow the build plan's Task 10 for the full E2E.

---

## Self-Review Checklist

- [ ] Fresh DB loaded from dump; existing local data unaffected (one
      shared container, but the restore drops + recreates inside it).
- [ ] Migration applied (column visible in `\d investments`).
- [ ] Banner shows / hides at the right times.
- [ ] Iframe page chrome composes correctly even without a real sheet.
- [ ] Transfer auto-push fires (log) for Materiały; skips silently for
      others.
- [ ] Bulk transfer fires per-row after commit.
- [ ] Investment auto-provision fires (log) on create.
- [ ] Vitest covers preview/apply diff logic; full suite green.
- [ ] Awaited-button failures are documented; their happy paths are
      deferred to real-Google Phase 5.

---

## What this plan does NOT cover

- Real Google API correctness — that's the build plan's Task 10.
- Iframe interaction (clicking cells, edits flowing back) — needs a
  real shared sheet + your own Google sign-in.
- `drive.files.copy` actually copying the template — needs real
  template + share.
- Reconciler under real drift conditions (rows manually deleted in
  Sheets, owner-typed orphans, simultaneous edits during preview→apply)
  — also Phase 5.
- Sheet protection / `addProtectedRange` — explicitly deferred per the
  build plan's TODO.
