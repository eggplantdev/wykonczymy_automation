# Kosztorys B-iframe PoC Build Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire one investment (id 31, "11 Listopada 40") end-to-end so creating a Wydatek inwestycyjny with category Materiały budowlane/wykończeniowe appends a row to the linked Google Sheet's `materiały ` tab and the row appears in an in-app iframe view of the sheet within seconds. Lock the materiały tab to service-account-only edits.

**Architecture:** Payload `afterChange` hook on `transactions` collection → Google Sheets API `values.append` against `'materiały '!A:H` of the investment's linked sheet → also applies an idempotent protected range on the materiały tab so only the service account can edit it. In-app route `/kosztorys/[investmentId]` renders `<iframe src="https://docs.google.com/spreadsheets/d/{id}/edit?embedded=true&rm=embedded">` so the owner sees the live sheet inside our app, with Google's native sync propagating both their edits and the app's pushes to all open viewers.

**Tech Stack:** Next.js 16 App Router, Payload CMS 3.73, `googleapis` SDK (server-side service account JWT auth), existing Postgres for `googleSheetId` on Investments, Vitest for the sheets-client unit tests.

**Context references:** Background, decision history, and PoC scope in `docs/plans/2026-05-20-kosztorys-sheets-integration.md`. Univer/Blob spike (committed as `fcbf647`) stays in place during the PoC for side-by-side comparison; its cleanup is Task 7 (optional, deferred until owner trial passes).

---

## Prerequisites (user-owned, must be done before Task 1)

These are manual setup steps the engineer cannot do. Confirm these are complete before starting Task 1.

- [ ] **Google Cloud project** — pick or create one (owner's call where it lives)
- [ ] **APIs enabled in that project:** Google Sheets API, Google Drive API
- [ ] **Service account created** in IAM → Service Accounts → "Create"; no roles needed
- [ ] **Service account JSON key downloaded** (the full JSON file)
- [ ] **Test sheet shared with the service account email** at Editor access. For the PoC this is the sheet owner intends to use for investment 31. (The service account email looks like `name@project-id.iam.gserviceaccount.com`.)
- [ ] **`.env` updated** with the JSON pasted as a single-line string:
  ```
  GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...whole JSON...}'
  ```
- [ ] **Sheet ID** of the test sheet noted somewhere (the long string between `/d/` and `/edit` in the sheet URL). Will be pasted into investment 31's `googleSheetId` field after Task 3 lands.

Until all of these are checked, the build cannot complete Task 6 (E2E verification), and Tasks 2–4 cannot be smoke-tested against the real API.

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
| `src/hooks/transfers/append-material-to-kosztorys.ts`         | modify | Swap Blob calls for Sheets API; add protection call                      |
| `src/app/(frontend)/kosztorys/[investmentId]/page.tsx`        | create | Server: load investment, render iframe via `googleSheetId`               |
| `src/app/(frontend)/kosztorys/[investmentId]/iframe-view.tsx` | create | Client: thin iframe wrapper (gets sheet id as prop)                      |

Files this plan does NOT touch (deferred to Task 7):

- `src/app/(frontend)/kosztorys-spike/**` — Univer spike stays for comparison
- `src/app/(frontend)/api/kosztorys/**` — Blob-backed routes stay
- `src/lib/kosztorys/**` — Blob lib stays
- `public/data/kosztorys-workbook.json` — generated workbook stays

The retargeted hook (`src/hooks/transfers/append-material-to-kosztorys.ts`) replaces its Blob target with Sheets — the file path stays the same so the wiring in `src/collections/transfers.ts` doesn't need updating.

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

This task owns two responsibilities: authenticating with the service account, and exposing two operations — `appendMaterialRow` (writes one row to materiały) and `ensureMaterialyProtection` (idempotently locks materiały to service-account-only edits).

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

### Task 4: Retarget the transfer hook from Blob to Sheets API

**Files:**

- Modify: `src/hooks/transfers/append-material-to-kosztorys.ts`

This task swaps the Blob storage calls for the new Sheets client. The hook's shape — fire-and-forget, filters by transfer type + category, looks up investment id — stays the same.

- [ ] **Step 1: Read the current hook**

Read: `src/hooks/transfers/append-material-to-kosztorys.ts` to refresh context on the current implementation.

- [ ] **Step 2: Replace the file with the Sheets-API implementation**

Overwrite `src/hooks/transfers/append-material-to-kosztorys.ts` with:

```ts
import type { CollectionAfterChangeHook } from 'payload'
import { appendMaterialRow, ensureMaterialyProtection } from '@/lib/google/sheets'
import type { MaterialKindT } from '@/lib/google/sheets'

const MATERIAL_CATEGORY_KIND: Record<string, MaterialKindT> = {
  'Materiały budowlane': 'budowlane',
  'Materiały wykończeniowe': 'wykończeniowe',
}

function resolveId(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return (value as { id: number }).id
  }
  return undefined
}

/**
 * afterChange — when a new INVESTMENT_EXPENSE with category Materiały budowlane
 * or wykończeniowe is created on an investment that has a linked Google Sheet
 * (`googleSheetId`), append a row to the materiały tab via Sheets API. Also
 * idempotently re-applies the materiały protection so a row's edit-lock
 * self-heals if anyone has removed the protection in the iframe.
 *
 * Fire-and-forget: any error logs but does not throw — transfer commits
 * are never blocked by Sheets API outages.
 */
export const appendMaterialToKosztorys: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  try {
    if (operation !== 'create') return doc
    if (doc.type !== 'INVESTMENT_EXPENSE') return doc

    const investmentId = resolveId(doc.investment)
    if (!investmentId) return doc

    const categoryId = resolveId(doc.expenseCategory)
    if (!categoryId) return doc

    const category = await req.payload.findByID({
      collection: 'expense-categories',
      id: categoryId,
      overrideAccess: true,
    })
    const kind = category?.name ? MATERIAL_CATEGORY_KIND[category.name] : undefined
    if (!kind) return doc

    const investment = await req.payload.findByID({
      collection: 'investments',
      id: investmentId,
      overrideAccess: true,
    })
    const sheetId = investment?.googleSheetId
    if (!sheetId) {
      console.log(
        `[kosztorys-sync] skip transfer #${doc.id}: no googleSheetId for investment #${investmentId}`,
      )
      return doc
    }

    await ensureMaterialyProtection(sheetId)
    await appendMaterialRow(sheetId, {
      kind,
      amount: Number(doc.amount),
      description: doc.description ?? '',
      transferId: doc.id,
      date: doc.date ? new Date(doc.date).toISOString().slice(0, 10) : undefined,
    })

    console.log(`[kosztorys-sync] appended transfer #${doc.id} → sheet ${sheetId} (${kind})`)
  } catch (err) {
    console.error('[kosztorys-sync] failed (non-fatal):', err)
  }

  return doc
}
```

- [ ] **Step 3: Typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS. If it complains about `doc.investment` / `doc.expenseCategory` shape, the `payload-types.ts` might need regenerating (`pnpm generate:types`).

- [ ] **Step 4: Verify wiring**

The hook is already registered in `src/collections/transfers.ts` (from the Univer spike work — `afterChange: [recalcAfterChange, appendMaterialToKosztorys]`). Confirm by reading the file; no change should be needed.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/transfers/append-material-to-kosztorys.ts
git commit -m "$(cat <<'EOF'
retarget kosztorys-sync hook from Vercel Blob to Google Sheets API

Hook shape unchanged (still fire-and-forget on INVESTMENT_EXPENSE +
Materiały budowlane/wykończeniowe). Each push first calls
ensureMaterialyProtection so the tab's edit-lock self-heals on every
transfer if anyone has removed the protection in the iframe, then
appends the row via Sheets API. The Blob lib (src/lib/kosztorys/) is
now unused; cleanup is deferred until owner trial passes.

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

- [ ] **Step 6: Confirm materiały is protected**

In the iframe (tab A), click any cell in the materiały tab and try to type.

Expected: Sheets shows the protection notice: "You are trying to edit a protected cell or object…". The edit is blocked.

Try editing a cell in another tab (e.g. `kosztorys_robocizny`).

Expected: the edit goes through normally.

- [ ] **Step 7: Confirm self-heal**

In a third browser tab, open the same sheet directly (not iframed): `https://docs.google.com/spreadsheets/d/<sheet-id>/edit`. Go to **Data → Protect sheets and ranges**, find the "Materiały: managed by app via API" protection, delete it.

Back in tab B, create another Wydatek (same fields, kwota 50, opis "self-heal test").

Switch to tab A's iframe, refresh the iframe (Ctrl-R on the iframe area, or use the "Open in Sheets ↗" link and come back).

Expected: the new row is present in materiały AND the protection is back. Confirm by trying to edit a materiały cell — it should be blocked again.

If self-heal didn't work, the `ensureMaterialyProtection` call may have raced with the append; double-check the order in the hook (protection first, then append) and the idempotent check (`alreadyProtected` filter) is correct.

- [ ] **Step 8: Hand off to owner for the one-week trial**

The PoC is now ready for owner trial. Per the decision brief, success criteria for the trial are:

1. Owner edits robocizny / pokoje in the iframe; changes persist + visible to team members with Drive access
2. Owner cannot accidentally edit materiały (verified by Step 6 above)
3. File → Download as xlsx, File → Print, version history, mobile editing all work via Sheets
4. After one week, owner gives "ship it to other investments" verdict

Document any rough edges the owner reports for the post-trial decision.

---

### Task 7 (optional, after owner trial passes): Clean up Univer / Blob spike

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
