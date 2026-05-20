# Kosztorys B-iframe PoC Build Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire one investment (id 31, "11 Listopada 40") end-to-end so creating a Wydatek inwestycyjny with category Materiały budowlane/wykończeniowe appends a row to the linked Google Sheet's `materiały ` tab and the row appears in an in-app iframe view of the sheet within seconds.

**Architecture:** Server action `createTransferAction` (and `createBulkTransferAction`) in `src/lib/actions/transfers.ts`, after `payload.create` succeeds → Google Sheets API `values.append` against `'materiały '!A:H` of the investment's linked sheet. In-app route `/kosztorys/[investmentId]` renders `<iframe src="https://docs.google.com/spreadsheets/d/{id}/edit?embedded=true&rm=embedded">` so the owner sees the live sheet inside our app, with Google's native sync propagating both their edits and the app's pushes to all open viewers.

> **Architecture decision (2026-05-20):** Project convention is "all mutations go through server actions" (CLAUDE.md). The original draft of this plan used a Payload `afterChange` hook; that's been changed to extend the existing server action instead. The Univer spike's hook (`src/hooks/transfers/append-material-to-kosztorys.ts`) is removed entirely in the pre-Task-1 cleanup.

---

## TODO — Deferred: materiały tab protection

**Decision deferred until after PoC trial.** The original draft of this plan applied an idempotent `addProtectedRange` on the materiały tab so only the service account could edit it (with self-heal on every push). For the PoC we skip protection entirely — both the function and any call to it. Materiały is editable by the owner and team in the iframe like any other tab.

**Why this needs careful consideration before re-enabling:**

- Protection covers the whole tab, including label cells (A2, E2 "Materiały budowlane/wykończeniowe") and SUM cells (B1, F1) — owner cannot adjust those without removing the protection
- Self-heal-on-every-push means an owner intentionally removing the protection (to fix something) gets it back on the next transfer create; that may surprise them more than help them
- Without protection, accidental edits to app-managed rows in materiały will happen and there is no audit trail — drift between Postgres `transactions` and the sheet's materiały rows is silent
- The owner trial **without** protection is itself the larger experiment: does the team's discipline / Drive sharing model handle this on its own, or is the lock genuinely needed?

**Re-evaluate after the one-week trial.** If owners report accidental edits to materiały, add protection back: Task 2 still includes the protection steps in the body (marked DEFERRED below) so the code is pre-designed and can be implemented in a follow-up.

**Tech Stack:** Next.js 16 App Router, Payload CMS 3.73, `googleapis` SDK (server-side service account JWT auth), existing Postgres for `googleSheetId` on Investments, Vitest for the sheets-client unit tests.

**Context references:** Background, decision history, and PoC scope in `docs/plans/2026-05-20-kosztorys-sheets-integration.md`. Univer/Blob spike (committed as `fcbf647`) was removed in the pre-Task-1 cleanup commit — the spike's hook is no longer present, and the side effect now lives in the transfer server action (Task 4).

---

## Prerequisites (user-owned, must be done before Task 1)

These are manual setup steps the engineer cannot do. Confirm these are complete before starting Task 1.

- [ ] **Google Cloud project** — pick or create one (owner's call where it lives)
- [ ] **APIs enabled in that project:** Google Sheets API **and Google Drive API** (both required — Sheets API for row append/delete, Drive API for auto-provisioning new sheets on investment creation)
- [ ] **Service account created** in IAM → Service Accounts → "Create"; no roles needed
- [ ] **Service account JSON key downloaded** (the full JSON file)
- [ ] **Template sheet** — clean kosztorys (no transactions, just the structure: tabs `kosztorys_robocizny`, `materiały ` with trailing space, `pokoje `, `Podsumowanie`, etc.). Owner-maintained, source of every new auto-provisioned sheet.
- [ ] **Template sheet shared with the service account email** at Editor access. (Editor needed — `drive.files.copy` requires read of the file and `files.create` parent permissions.)
- [ ] **Template sheet's file ID noted** (long string between `/d/` and `/edit` in the URL).
- [ ] **(Optional) Destination Drive folder** for all auto-provisioned sheets. Service account needs Editor on this folder.
- [ ] **Existing investment 31's sheet shared with the service account email** at Editor access. (For the PoC trial — investment 31 was created before auto-provisioning existed, so its sheet was made manually. Owner pastes its ID into investment 31's `googleSheetId` field after Task 4 lands.)
- [ ] **`.env` updated** with:
  ```
  GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...whole JSON...}'
  KOSZTORYS_TEMPLATE_SHEET_ID='1AbC...XyZ'
  # optional:
  KOSZTORYS_DRIVE_FOLDER_ID='1FoldERid...'
  ```

**No backfill for existing investments.** Investments created before auto-provisioning ships (everything except those created via `createInvestmentAction` after Task 8) will NOT auto-get a sheet. If the owner wants a sheet for an existing investment, they create one manually (copy template) and paste its ID into the `googleSheetId` field in the admin panel. Investment 31 is the working example of this manual path during the PoC trial.

Until all of these are checked, the build cannot complete Task 9 (E2E verification), and Tasks 2–8 cannot be smoke-tested against the real API.

---

## File Structure (decomposition decisions)

Files this plan creates or modifies:

| File                                                          | Status | Responsibility                                                           |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `package.json`                                                | modify | Add `googleapis` dependency                                              |
| `src/lib/env.ts`                                              | modify | Add `GOOGLE_SERVICE_ACCOUNT_JSON` to Zod validation                      |
| `src/lib/google/sheets.ts`                                    | create | Service-account auth + `appendMaterialRow` + `ensureMaterialyProtection` |
| `src/__tests__/lib/google/sheets.test.ts`                     | create | Unit tests for the sheets client (mocks `googleapis`)                    |
| `src/migrations/{generated}.ts`                               | create | Adds `googleSheetId` column to `investments` table                       |
| `src/collections/investments.ts`                              | modify | Declares the `googleSheetId` field                                       |
| `src/lib/actions/transfers.ts`                                | modify | Sync materiały append to Sheets after `payload.create` (replaces hook)   |
| `src/app/(frontend)/kosztorys/[investmentId]/page.tsx`        | create | Server: load investment, render iframe via `googleSheetId`               |
| `src/app/(frontend)/kosztorys/[investmentId]/iframe-view.tsx` | create | Client: thin iframe wrapper (gets sheet id as prop)                      |

Files this plan does NOT touch (deferred to Task 7):

- `src/app/(frontend)/kosztorys-spike/**` — Univer spike stays for comparison
- `src/app/(frontend)/api/kosztorys/**` — Blob-backed routes stay
- `src/lib/kosztorys/**` — Blob lib stays
- `public/data/kosztorys-workbook.json` — generated workbook stays

The spike's Payload `afterChange` hook (`src/hooks/transfers/append-material-to-kosztorys.ts`) is gone. Its side-effect responsibility moves into the existing `createTransferAction` / `createBulkTransferAction` server actions in `src/lib/actions/transfers.ts` (per project convention — all mutations go through server actions). The `appendMaterialToKosztorys` reference was already removed from `src/collections/transfers.ts`'s `afterChange` array during the pre-Task-1 cleanup.

---

### Task 1: Install googleapis and validate env

**Files:**

- Modify: `package.json`
- Modify: `src/lib/env.ts`

- [ ] **Step 1: Install googleapis**

Run:

```bash
pnpm add googleapis
```

Expected: dependency added to `package.json`, lockfile updated.

- [ ] **Step 2: Read the current env validation file**

Read: `src/lib/env.ts` — note the Zod schema shape and how existing vars are validated.

- [ ] **Step 3: Add GOOGLE_SERVICE_ACCOUNT_JSON to the Zod schema**

In `src/lib/env.ts`, add an entry to the schema. Pattern matches existing vars; the JSON validation is a string with a JSON-parse refinement to catch malformed values at startup:

```ts
GOOGLE_SERVICE_ACCOUNT_JSON: z
  .string()
  .min(1, 'GOOGLE_SERVICE_ACCOUNT_JSON is required')
  .refine(
    (raw) => {
      try {
        const parsed = JSON.parse(raw)
        return typeof parsed?.client_email === 'string' && typeof parsed?.private_key === 'string'
      } catch {
        return false
      }
    },
    'GOOGLE_SERVICE_ACCOUNT_JSON must be valid JSON with client_email and private_key',
  ),
```

If the existing file groups env vars into sections, place this near other third-party API tokens (e.g., near `BLOB_READ_WRITE_TOKEN`).

- [ ] **Step 4: Restart and verify env validates**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

Then start dev (will validate env at boot):

```bash
pnpm dev
```

Expected: server starts on port 3001 (or 3000 if free) without throwing about `GOOGLE_SERVICE_ACCOUNT_JSON`. Kill the dev server after the boot succeeds.

If env throws "must be valid JSON with client_email and private_key" — double-check the user pasted the JSON correctly as a single-line string with single quotes around it in `.env`.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/env.ts
git commit -m "$(cat <<'EOF'
add googleapis and validate service-account env var

Prep for Sheets API integration. Env validation enforces the JSON has
client_email and private_key so a bad paste fails at startup, not at
first hook invocation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Build the Sheets client library (with tests)

**Files:**

- Create: `src/lib/google/sheets.ts`
- Create: `src/__tests__/lib/google/sheets.test.ts`

This task owns service-account auth + `appendMaterialRow` (writes one row to materiały).

> **DEFERRED:** Steps 5–8 below (`ensureMaterialyProtection` function + its three unit tests) are skipped for the PoC per the TODO at the top of this plan. Leave the steps in place as design documentation for the follow-up. Stop after Step 4 and jump to Step 9 (commit) — the commit body should reflect that only `appendMaterialRow` was built.

Column layout in the materiały tab (0-based):

- budowlane: A(0)=label, B(1)=amount, C(2)=description, D(3)=comment
- wykończeniowe: E(4)=label, F(5)=amount, G(6)=description, H(7)=settled

The tab name has a trailing space: `'materiały '`. Preserve it.

- [ ] **Step 1: Write the failing test for `appendMaterialRow`**

Create: `src/__tests__/lib/google/sheets.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock googleapis before importing the module under test
const appendMock = vi.fn().mockResolvedValue({ data: {} })
const getMock = vi.fn().mockResolvedValue({ data: { sheets: [] } })
const batchUpdateMock = vi.fn().mockResolvedValue({ data: {} })

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: vi.fn().mockImplementation(() => ({})),
    },
    sheets: vi.fn().mockReturnValue({
      spreadsheets: {
        get: getMock,
        batchUpdate: batchUpdateMock,
        values: { append: appendMock },
      },
    }),
  },
}))

beforeEach(() => {
  appendMock.mockClear()
  getMock.mockClear()
  batchUpdateMock.mockClear()
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'test@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIITEST\n-----END PRIVATE KEY-----\n',
  })
})

describe('appendMaterialRow', () => {
  it('writes [amount, description] into B:C for budowlane', async () => {
    const { appendMaterialRow } = await import('@/lib/google/sheets')
    await appendMaterialRow('sheet-id-1', {
      kind: 'budowlane',
      amount: 100,
      description: 'cement',
      transferId: 2431,
      date: '2026-05-20',
    })

    expect(appendMock).toHaveBeenCalledTimes(1)
    const call = appendMock.mock.calls[0][0]
    expect(call.spreadsheetId).toBe('sheet-id-1')
    expect(call.range).toBe("'materiały '!B:C")
    expect(call.valueInputOption).toBe('USER_ENTERED')
    expect(call.insertDataOption).toBe('INSERT_ROWS')
    expect(call.requestBody.values).toEqual([[100, 'cement [2026-05-20] #2431']])
  })

  it('writes [amount, description] into F:G for wykończeniowe', async () => {
    const { appendMaterialRow } = await import('@/lib/google/sheets')
    await appendMaterialRow('sheet-id-2', {
      kind: 'wykończeniowe',
      amount: 250.5,
      description: 'farba',
      transferId: 99,
      date: '2026-05-20',
    })

    const call = appendMock.mock.calls[0][0]
    expect(call.range).toBe("'materiały '!F:G")
    expect(call.requestBody.values).toEqual([[250.5, 'farba [2026-05-20] #99']])
  })
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run:

```bash
pnpm test -- src/__tests__/lib/google/sheets.test.ts
```

Expected: FAIL with `Cannot find module '@/lib/google/sheets'`.

- [ ] **Step 3: Implement appendMaterialRow**

Create: `src/lib/google/sheets.ts`

```ts
import { google, sheets_v4 } from 'googleapis'

export type MaterialKindT = 'budowlane' | 'wykończeniowe'

export type AppendMaterialInputT = {
  kind: MaterialKindT
  amount: number
  description: string
  transferId: number | string
  date?: string
}

const MATERIALY_TAB = 'materiały ' // trailing space matches source template
const COLUMN_RANGE: Record<MaterialKindT, string> = {
  budowlane: 'B:C',
  wykończeniowe: 'F:G',
}

function getClient(): sheets_v4.Sheets {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
  const creds = JSON.parse(raw) as { client_email: string; private_key: string }
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

export async function appendMaterialRow(
  spreadsheetId: string,
  input: AppendMaterialInputT,
): Promise<void> {
  const sheets = getClient()
  const range = `'${MATERIALY_TAB}'!${COLUMN_RANGE[input.kind]}`
  const dateSuffix = input.date ? ` [${input.date}]` : ''
  const descWithRef = `${input.description}${dateSuffix} #${input.transferId}`

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[input.amount, descWithRef]] },
  })
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run:

```bash
pnpm test -- src/__tests__/lib/google/sheets.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Write the failing test for `ensureMaterialyProtection`**

Append to `src/__tests__/lib/google/sheets.test.ts`:

```ts
describe('ensureMaterialyProtection', () => {
  const PROTECTION_DESCRIPTION = 'Materiały: managed by app via API'

  it('adds a protected range when none exists', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        sheets: [
          {
            properties: { sheetId: 42, title: 'materiały ' },
            protectedRanges: [],
          },
        ],
      },
    })
    const { ensureMaterialyProtection } = await import('@/lib/google/sheets')
    await ensureMaterialyProtection('sheet-id-3')

    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    const call = batchUpdateMock.mock.calls[0][0]
    expect(call.spreadsheetId).toBe('sheet-id-3')
    const req = call.requestBody.requests[0].addProtectedRange.protectedRange
    expect(req.description).toBe(PROTECTION_DESCRIPTION)
    expect(req.range.sheetId).toBe(42)
    expect(req.warningOnly).toBe(false)
    expect(req.editors.users).toEqual(['test@example.iam.gserviceaccount.com'])
  })

  it('skips when a protection with our marker already exists', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        sheets: [
          {
            properties: { sheetId: 42, title: 'materiały ' },
            protectedRanges: [
              { description: 'Materiały: managed by app via API', range: { sheetId: 42 } },
            ],
          },
        ],
      },
    })
    const { ensureMaterialyProtection } = await import('@/lib/google/sheets')
    await ensureMaterialyProtection('sheet-id-4')

    expect(batchUpdateMock).not.toHaveBeenCalled()
  })

  it('throws if materiały tab is missing', async () => {
    getMock.mockResolvedValueOnce({
      data: { sheets: [{ properties: { sheetId: 1, title: 'OtherTab' } }] },
    })
    const { ensureMaterialyProtection } = await import('@/lib/google/sheets')
    await expect(ensureMaterialyProtection('sheet-id-5')).rejects.toThrow(/materiały/)
  })
})
```

- [ ] **Step 6: Run the new tests, confirm they fail**

Run:

```bash
pnpm test -- src/__tests__/lib/google/sheets.test.ts
```

Expected: 3 new tests FAIL (function not exported).

- [ ] **Step 7: Implement ensureMaterialyProtection**

Append to `src/lib/google/sheets.ts`:

```ts
const PROTECTION_DESCRIPTION = 'Materiały: managed by app via API'

export async function ensureMaterialyProtection(spreadsheetId: string): Promise<void> {
  const sheets = getClient()
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
  const serviceAccountEmail = (JSON.parse(raw) as { client_email: string }).client_email

  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const materialy = meta.data.sheets?.find((s) => s.properties?.title === MATERIALY_TAB)
  if (!materialy?.properties?.sheetId) {
    throw new Error(`materiały tab not found on ${spreadsheetId}`)
  }
  const sheetId = materialy.properties.sheetId

  const alreadyProtected = (materialy.protectedRanges ?? []).some(
    (p) => p.description === PROTECTION_DESCRIPTION,
  )
  if (alreadyProtected) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addProtectedRange: {
            protectedRange: {
              description: PROTECTION_DESCRIPTION,
              warningOnly: false,
              range: { sheetId },
              editors: { users: [serviceAccountEmail] },
            },
          },
        },
      ],
    },
  })
}
```

- [ ] **Step 8: Run all sheets-client tests, confirm pass**

Run:

```bash
pnpm test -- src/__tests__/lib/google/sheets.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/google/sheets.ts src/__tests__/lib/google/sheets.test.ts
git commit -m "$(cat <<'EOF'
add Google Sheets client for materiały append and protection

appendMaterialRow uses USER_ENTERED + INSERT_ROWS so existing SUM
formulas in B1/F1 keep aggregating without us tracking row numbers.
ensureMaterialyProtection is idempotent: reads existing protected
ranges, only adds one if our marker description isn't already present.
Service account email read from env so the protection's editor list
auto-tracks the active credential.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add `googleSheetId` field to Investments

**Files:**

- Create: `src/migrations/{auto-named}.ts` (generated by Payload CLI)
- Modify: `src/collections/investments.ts`

CLAUDE.md note (important): always use `pnpm migrate:create` first, never hand-write migrations — Payload internal tables (e.g., `payload_locked_documents_rels`) are easy to miss.

- [ ] **Step 1: Add the field to the Investments collection config**

Modify: `src/collections/investments.ts`. Find the `fields:` array and append a new entry alongside `status`:

```ts
{
  name: 'googleSheetId',
  type: 'text',
  label: { en: 'Google Sheet ID', pl: 'ID arkusza Google' },
  admin: {
    description: {
      en: 'Long string between /d/ and /edit in the sheet URL. Used to embed the sheet and to push transfers via Sheets API.',
      pl: 'Długi ciąg pomiędzy /d/ a /edit w URL arkusza. Używane do osadzenia arkusza i wysyłania transakcji przez Sheets API.',
    },
  },
}
```

Place it after `status` so it appears at the bottom of the admin form. Don't mark it required — investments without a sheet should still work in the rest of the app.

- [ ] **Step 2: Generate the migration**

Run:

```bash
pnpm migrate:create
```

Expected: prompts for a migration name. Enter: `add-google-sheet-id-to-investments`.

A new file appears under `src/migrations/`. Read it and verify it ONLY adds the `google_sheet_id` column to the `investments` table (it should be a single `ALTER TABLE` adding the column).

If the generated migration includes other unrelated changes, abort and investigate — there may be drift between the schema and the DB that needs separate cleanup first.

- [ ] **Step 3: Run the migration locally and regenerate types**

Run:

```bash
pnpm migrate:create  # confirms the migration list
```

The migration runs as part of `pnpm build`, but to apply it locally without a full build, restart the dev server (which calls `migrate` during boot via the npm scripts):

```bash
pnpm dev
```

Wait for "Ready". Verify in the console that the migration is logged as run. Kill the dev server.

Regenerate types:

```bash
pnpm generate:types
```

Expected: `src/payload-types.ts` regenerated (it's in `.gitignore` per CLAUDE.md — don't try to commit it).

- [ ] **Step 4: Typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS. If it fails referencing `googleSheetId`, the types didn't regenerate — re-run `pnpm generate:types`.

- [ ] **Step 5: Commit**

```bash
git add src/collections/investments.ts src/migrations/
git commit -m "$(cat <<'EOF'
add googleSheetId field to Investments

Stores the long string between /d/ and /edit in the Sheets URL. Used
by the kosztorys iframe view and the transfer-sync hook to identify
which sheet to push to. Optional — investments without a sheet stay
fully functional in the rest of the app.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Trigger the Sheets append from the transfer server action

**Files:**

- Modify: `src/lib/actions/transfers.ts`

> **REVISED (2026-05-20):** Original task retargeted a Payload `afterChange` hook from Blob to Sheets. Per project convention ("all mutations through server actions"), the hook has been removed entirely in the pre-Task-1 cleanup; this task now extends `createTransferAction` (and `createBulkTransferAction`) directly. Fire-and-forget semantics preserved — Sheets errors log but never fail the action.

> **DEFERRED:** No call to `ensureMaterialyProtection` per the TODO at the top of this plan. Only `appendMaterialRow` is called from the server action.

- [ ] **Step 1: Read the current server actions**

Read: `src/lib/actions/transfers.ts` — note the shape of `createTransferAction` (line ~26) and `createBulkTransferAction` (line ~72). Both call `payload.create({ collection: 'transactions', ... })` inside a `protectedAction()` wrapper. The Sheets append needs to fire AFTER `payload.create` returns successfully, with the created doc's `id` and `description` available.

- [ ] **Step 2: Add a Sheets-sync helper inside the actions file**

Add this helper near the top of `src/lib/actions/transfers.ts` (after imports, before the first action):

```ts
import { appendMaterialRow, type MaterialKindT } from '@/lib/google/sheets'

const MATERIAL_CATEGORY_KIND: Record<string, MaterialKindT> = {
  'Materiały budowlane': 'budowlane',
  'Materiały wykończeniowe': 'wykończeniowe',
}

/**
 * Fire-and-forget Sheets sync. Resolves the investment's googleSheetId and
 * the expense category, and appends a materiały row if all conditions match.
 * Any error logs but never throws — the transfer create has already
 * succeeded by the time we get here.
 */
async function syncMaterialToSheet(params: {
  transferId: number
  type: string
  amount: number
  description: string | null
  date: string | Date
  investmentId: number | undefined
  expenseCategoryName: string | undefined
}): Promise<void> {
  try {
    if (params.type !== 'INVESTMENT_EXPENSE') return
    if (!params.investmentId) return
    if (!params.expenseCategoryName) return

    const kind = MATERIAL_CATEGORY_KIND[params.expenseCategoryName]
    if (!kind) return

    const payload = await getPayload({ config })
    const investment = await payload.findByID({
      collection: 'investments',
      id: params.investmentId,
      overrideAccess: true,
    })
    const sheetId = investment?.googleSheetId
    if (!sheetId) {
      console.log(
        `[kosztorys-sync] skip transfer #${params.transferId}: no googleSheetId for investment #${params.investmentId}`,
      )
      return
    }

    await appendMaterialRow(sheetId, {
      kind,
      amount: params.amount,
      description: params.description ?? '',
      transferId: params.transferId,
      date: new Date(params.date).toISOString().slice(0, 10),
    })

    console.log(
      `[kosztorys-sync] appended transfer #${params.transferId} → sheet ${sheetId} (${kind})`,
    )
  } catch (err) {
    console.error('[kosztorys-sync] failed (non-fatal):', err)
  }
}
```

If the file doesn't already import `getPayload` / `config`, add `import { getPayload } from 'payload'` and `import config from '@payload-config'`.

- [ ] **Step 3: Call the helper from `createTransferAction`**

After the `await payload.create({ collection: 'transactions', ... })` call inside `createTransferAction`, capture the result and invoke the helper. The expense category name has to be resolved from `data.expenseCategory` (which is the id) — easiest is to read it from the validated input + a `findByID` inside the helper, OR pass the resolved name from a single lookup. Pattern:

```ts
const created = await payload.create({
  collection: 'transactions',
  data: { ...parsed, createdBy: user.id /* ... */ },
})
console.log(`[PERF]   payload.create ${step()}ms`)

let expenseCategoryName: string | undefined
if (parsed.expenseCategory) {
  const cat = await payload.findByID({
    collection: 'expense-categories',
    id: parsed.expenseCategory,
    overrideAccess: true,
  })
  expenseCategoryName = cat?.name
}

// fire-and-forget; do NOT await, do NOT include in ActionResult
void syncMaterialToSheet({
  transferId: created.id,
  type: parsed.type,
  amount: Number(parsed.amount),
  description: parsed.description ?? null,
  date: parsed.date,
  investmentId: parsed.investment,
  expenseCategoryName,
})
```

The exact placement depends on the existing code shape — read the action first and adapt. The `void` prefix matters: `await`-ing would re-introduce the Sheets-API outage as a blocker for the user-visible action.

- [ ] **Step 4: Repeat for `createBulkTransferAction`**

Bulk action creates N transfers in a loop. Each successful `payload.create` should fire its own `void syncMaterialToSheet(...)`. Do not batch — each row independently determines whether it's a Materiały item.

- [ ] **Step 5: Typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS. If `investment.googleSheetId` is typed as `unknown`, re-run `pnpm generate:types`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/transfers.ts
git commit -m "$(cat <<'EOF'
sync materiały transfers to Google Sheet from the transfer server action

createTransferAction and createBulkTransferAction now fire-and-forget a
Sheets API append after a successful payload.create when the transfer
is INVESTMENT_EXPENSE + category Materiały budowlane/wykończeniowe and
the investment has a googleSheetId. Sheets errors log but never fail
the action — the user-visible transfer commit is unaffected.

No Payload afterChange hook is used: project convention is all
mutations go through server actions, so the side effect belongs here.
Materiały tab protection deferred — see TODO in the build plan.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Build the `/kosztorys/[investmentId]` iframe view

**Files:**

- Create: `src/app/(frontend)/kosztorys/[investmentId]/page.tsx`
- Create: `src/app/(frontend)/kosztorys/[investmentId]/iframe-view.tsx`

The route lives in the `(frontend)` group so it's auth-gated by the existing layout. The page is a server component that resolves the investment and its `googleSheetId`; the iframe wrapper is a small client component for any future client-side bits.

- [ ] **Step 1: Create the iframe client component**

Create: `src/app/(frontend)/kosztorys/[investmentId]/iframe-view.tsx`

```tsx
'use client'

type IframeViewProps = {
  sheetId: string
  investmentName: string
  investmentId: number
}

export function KosztorysIframeView({ sheetId, investmentName, investmentId }: IframeViewProps) {
  const src = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing&rm=embedded&embedded=true`

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-b px-4 py-2">
        <div className="flex flex-col">
          <h1 className="text-foreground text-sm font-medium">Kosztorys — {investmentName}</h1>
          <span className="text-muted-foreground text-xs">
            Google Sheets · investment #{investmentId}
          </span>
        </div>
        <a
          href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground text-xs underline"
        >
          Open in Sheets ↗
        </a>
      </div>
      <iframe
        src={src}
        title={`Kosztorys for ${investmentName}`}
        className="w-full flex-1 border-0"
      />
    </div>
  )
}
```

- [ ] **Step 2: Create the server page**

Create: `src/app/(frontend)/kosztorys/[investmentId]/page.tsx`

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getInvestment } from '@/lib/queries/investments'
import { KosztorysIframeView } from './iframe-view'

export default async function KosztorysPage({
  params,
}: {
  params: Promise<{ investmentId: string }>
}) {
  const { investmentId } = await params
  const id = Number(investmentId)
  if (!Number.isFinite(id) || id <= 0) notFound()

  const investment = await getInvestment(investmentId)
  if (!investment) notFound()

  if (!investment.googleSheetId) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-foreground text-lg font-medium">{investment.name}</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          No Google Sheet linked to this investment yet. Paste the sheet ID into the investment
          record in the admin panel.
        </p>
        <Link
          href={`/admin/collections/investments/${id}`}
          className="bg-primary text-primary-foreground rounded px-4 py-2 text-sm"
        >
          Open admin
        </Link>
      </div>
    )
  }

  return (
    <KosztorysIframeView
      sheetId={investment.googleSheetId}
      investmentName={investment.name}
      investmentId={id}
    />
  )
}
```

- [ ] **Step 3: Typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS. If `investment.googleSheetId` is typed `unknown` / missing, re-run `pnpm generate:types`.

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(frontend)/kosztorys/'
git commit -m "$(cat <<'EOF'
add /kosztorys/[investmentId] iframe view

Server page resolves the investment, renders the live Google Sheet via
iframe-edit URL (rm=embedded mode bypasses X-Frame-Options). Shows a
seed CTA when googleSheetId is empty. "Open in Sheets ↗" link gives
the owner an escape hatch to the full Sheets UI in a new tab.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: End-to-end manual verification

**Files:** none — this is an integration check, not new code.

This is the gate that determines whether the PoC enters its one-week owner trial. All steps require user-owned setup from Prerequisites to be complete.

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

Wait for "Ready". Confirm no env validation errors at startup.

- [ ] **Step 2: Paste the sheet ID into investment 31**

Open the admin panel at `http://localhost:3001/admin/collections/investments/31`. Find the new "Google Sheet ID" field at the bottom. Paste the sheet ID (the part between `/d/` and `/edit` in the sheet URL). Save.

- [ ] **Step 3: Open the kosztorys page in browser tab A**

Navigate to `http://localhost:3001/kosztorys/31`.

Expected: the live Google Sheet renders inside an iframe. The header shows "Kosztorys — 11 Listopada 40". You can scroll, switch tabs (kosztorys_robocizny, materiały, etc.), and click cells in the sheet just like in Sheets.

If the iframe shows "Refused to connect" or is blank: revisit the iframe viability with `/kosztorys-iframe` (paste the same sheet ID). If that also fails, your Workspace admin may block embedding — fall back path in the decision brief.

- [ ] **Step 4: In browser tab B, create a Wydatek for investment 31**

Open `http://localhost:3001/` (dashboard). Click the "Wydatek" button to open the Nowy wydatek modal. Fill:

- Typ wydatku: **Wydatek inwestycyjny** (preselected)
- Inwestycja: **11 Listopada 40**
- Kasa: any active register (e.g. "Adam Bazylewicz")
- Kwota: **150** (small to avoid balance concerns)
- Opis: **e2e test sheets api**
- Typ wydatku inwestycyjnego: **Materiały budowlane**

Click "Dodaj".

Expected: modal closes, transactions table shows the new row.

- [ ] **Step 5: Confirm the row appears in the iframe (tab A) within ~3 seconds**

Switch to tab A. Open the materiały tab inside the iframe.

Expected: a new row appears in the first empty row under the headers, with kwota brutto = 150 in column B and description "e2e test sheets api [YYYY-MM-DD] #NNNN" in column C. The cell B1 SUM total updates by 150.

If the row doesn't appear:

- Check the dev server log for `[kosztorys-sync] appended transfer #N → sheet S (budowlane)`. If absent, the hook didn't trigger — check the transfer type and expense category were resolved correctly.
- If the log says `[kosztorys-sync] failed (non-fatal): ...`, read the error. Common: service account isn't shared on the sheet (share with Editor access), or the materiały tab is named differently than `'materiały '` (the trailing space must be present).

> **DEFERRED:** Steps 6 (protection edit-block) and 7 (self-heal) skipped per the TODO at the top of this plan. Owner edits to materiały are NOT prevented during the trial — this is itself an experiment (see TODO).

- [ ] **Step 6: Hand off to owner for the one-week trial**

The PoC is now ready for owner trial. Per the decision brief (with protection deferred), success criteria for the trial are:

1. Owner edits robocizny / pokoje in the iframe; changes persist + visible to team members with Drive access
2. File → Download as xlsx, File → Print, version history, mobile editing all work via Sheets
3. **NEW: Owner does NOT accidentally edit app-managed materiały rows.** If they do, capture the incident — it's the signal for re-enabling protection per the TODO.
4. After one week, owner gives "ship it to other investments" verdict

Document any rough edges the owner reports for the post-trial decision.

---

### Task 7.5: Auto-provision sheet on investment creation

**Files:**

- Create: `src/lib/google/drive.ts` — Drive client + `createKosztorysFromTemplate`
- Modify: `src/lib/actions/investments.ts` — `createInvestmentAction` fires the provisioning

**Goal:** when an investment is created in the app via `createInvestmentAction`, automatically copy the template sheet in Drive, name the copy `Kosztorys – {investment.name}`, and write the new sheet's ID into the investment's `googleSheetId` field. Fire-and-forget — provisioning failure must not block investment creation.

- [ ] **Step 1: Add Drive client + `createKosztorysFromTemplate`**

Create: `src/lib/google/drive.ts`

```ts
import { google, drive_v3 } from 'googleapis'

function getDriveClient(): drive_v3.Drive {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
  const creds = JSON.parse(raw) as { client_email: string; private_key: string }
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })
  return google.drive({ version: 'v3', auth })
}

export async function createKosztorysFromTemplate(
  investmentName: string,
): Promise<{ sheetId: string }> {
  const drive = getDriveClient()
  const templateId = process.env.KOSZTORYS_TEMPLATE_SHEET_ID
  if (!templateId) throw new Error('KOSZTORYS_TEMPLATE_SHEET_ID not set')
  const folderId = process.env.KOSZTORYS_DRIVE_FOLDER_ID

  const copy = await drive.files.copy({
    fileId: templateId,
    requestBody: {
      name: `Kosztorys – ${investmentName}`,
      ...(folderId ? { parents: [folderId] } : {}),
    },
    fields: 'id',
  })

  if (!copy.data.id) throw new Error('Drive returned no file id')
  return { sheetId: copy.data.id }
}
```

- [ ] **Step 2: Add `KOSZTORYS_TEMPLATE_SHEET_ID` + optional `KOSZTORYS_DRIVE_FOLDER_ID` to env validation**

Modify `src/lib/env.ts`:

```ts
KOSZTORYS_TEMPLATE_SHEET_ID: z.string().min(1, 'KOSZTORYS_TEMPLATE_SHEET_ID is required'),
KOSZTORYS_DRIVE_FOLDER_ID: z.string().optional(),
```

- [ ] **Step 3: Wire into `createInvestmentAction`**

Modify `src/lib/actions/investments.ts`. After the `payload.create` call, fire-and-forget the provisioning and update the investment with the resulting `googleSheetId`:

```ts
const created = await payload.create({
  collection: 'investments',
  data: parsed.data,
})

void createKosztorysFromTemplate(created.name)
  .then(({ sheetId }) =>
    payload.update({
      collection: 'investments',
      id: created.id,
      data: { googleSheetId: sheetId },
      overrideAccess: true,
    }),
  )
  .then(() => console.log(`[kosztorys-provision] investment #${created.id} → sheet provisioned`))
  .catch((err) =>
    console.error(`[kosztorys-provision] investment #${created.id} failed (non-fatal):`, err),
  )

return { success: true }
```

`void` matters — `await` would block the user-visible create on Drive API latency / outages.

- [ ] **Step 4: Tests**

Add unit tests for `createKosztorysFromTemplate` (mocked `googleapis.drive.files.copy`) — verifies `fileId`, `name`, `parents`, return shape. Same mock pattern as the sheets-client tests.

- [ ] **Step 5: E2E verification**

In the admin panel, create a test investment. Watch the dev server log for `[kosztorys-provision] investment #N → sheet provisioned`. Verify in Drive that a new file `Kosztorys – {name}` exists. Refresh the investment in the admin panel — `googleSheetId` should now be populated (provisioning is async, may take a few seconds). Open `/inwestycje/{N}/kosztorys` — iframe loads the new (empty-template) sheet.

- [ ] **Step 6: Commit**

```bash
git add src/lib/google/drive.ts src/lib/env.ts src/lib/actions/investments.ts src/__tests__/lib/google/drive.test.ts
git commit -m "$(cat <<'EOF'
auto-provision Google Sheet on investment creation

createInvestmentAction fires a fire-and-forget Drive files.copy from
the kosztorys template, then writes the new sheet id into the
investment's googleSheetId field. Failure logs but never blocks the
investment create — owner can always paste a sheet id manually.

No backfill for investments created before this lands.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7 — DONE (executed in pre-Task-1 cleanup commit): Clean up Univer / Blob spike

> Originally scheduled as optional post-trial cleanup. Moved earlier and executed as the pre-Task-1 commit. Steps below kept as historical record of what was removed.

**Files:**

- Delete: `src/app/(frontend)/kosztorys-spike/`
- Delete: `src/app/(frontend)/api/kosztorys/`
- Delete: `src/lib/kosztorys/`
- Delete: `public/data/kosztorys-workbook.json`
- Delete: `scripts/convert-kosztorys-xlsx.py` (optional — keep if we'll re-seed templates from xlsx)
- Modify: `package.json` — uninstall `@univerjs/presets`, `@univerjs/preset-sheets-core`, `@vercel/blob`

Skip this task until the owner has run the PoC for a week and confirmed it works. Before then, the spike code is useful for side-by-side comparison and as a fallback if B-iframe hits a snag.

- [ ] **Step 1: Confirm the PoC owner trial has passed**

Verify the success-criteria checklist in `docs/plans/2026-05-20-kosztorys-sheets-integration.md` ("Success criteria (PoC passes if all hold)") is satisfied.

- [ ] **Step 2: Delete spike directories**

```bash
rm -rf src/app/\(frontend\)/kosztorys-spike
rm -rf src/app/\(frontend\)/api/kosztorys
rm -rf src/lib/kosztorys
rm public/data/kosztorys-workbook.json
```

- [ ] **Step 3: Uninstall unused dependencies**

```bash
pnpm remove @univerjs/presets @univerjs/preset-sheets-core @vercel/blob
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS. If anything references the deleted modules, search-and-replace until clean.

- [ ] **Step 5: Test suite**

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -u  # captures deletions
git add package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
remove Univer + Blob spike after B-iframe PoC passes owner trial

Univer spike served its purpose — proved Sheets is the better path. The
xlsx → IWorkbookData converter (scripts/convert-kosztorys-xlsx.py)
stays in tree as a future seeding helper if we ever push our cleaned-up
template to a new Sheet via the Drive API.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist (run after the plan is written, before execution starts)

- [ ] Every prerequisite is owned by a human and clearly marked as such
- [ ] Every task lists exact file paths
- [ ] Every code-changing step contains the actual code (no "implement here" placeholders)
- [ ] Test expectations are concrete (exact assertion shape, not "test it works")
- [ ] Commit commands include the actual files being committed
- [ ] Types/method names referenced in later tasks match what earlier tasks define (`appendMaterialRow`, `ensureMaterialyProtection`, `MaterialKindT`)
- [ ] The plan does not require knowledge from this conversation — it stands alone
- [ ] PoC success criteria from the decision brief are reachable from this plan's tasks

---

## After this plan

The PoC enters a one-week owner trial. During the trial, **do not modify the production hook or sheets client** — let the owner experience the unchanged behavior so feedback is meaningful. If the owner reports rough edges, capture them in a follow-up doc rather than patching live.

If the trial passes, the next plan is **multi-investment rollout**: Drive API `files.copy` from a template, sheet provisioning on investment creation, error handling at scale, sharing automation, key rotation policy.

If the trial fails, revisit the failure-modes section of the decision brief and pick a fallback (A1 = Postgres + custom editor, or B without iframe = deep-link only).
