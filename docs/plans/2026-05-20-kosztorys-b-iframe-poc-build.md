# Kosztorys B-iframe PoC Build Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. After each task, run the `simplify` skill on the changed files before the commit.

**Goal:** Wire one investment (id 31, "11 Listopada 40") end-to-end so that:

- Creating a _Wydatek inwestycyjny_ with category Materiały budowlane / wykończeniowe appends a row to the linked Google Sheet's `materiały ` tab; the row appears in an in-app iframe view within seconds (auto-push, fire-and-forget).
- Cancelling such a transfer in the app removes the corresponding row from the sheet (auto-push, fire-and-forget).
- A manual sync button (**preview → confirm**) reconciles any drift between Postgres and the sheet.
- Creating a new investment **auto-provisions** a fresh sheet from a Drive template and links it.
- Existing investments without a `googleSheetId` show a layout-level banner across `/inwestycje/[id]/*` with two CTAs: "Powiąż istniejący arkusz" and "Utwórz nowy kosztorys".

**Architecture:** Sheets API push from server actions; reconciliation pattern (manual sync button) instead of outbox; Drive API for auto-provisioning; iframe-edit view inside the app.

> **Architecture decisions (cumulative through 2026-05-21):**
>
> 1. **Server actions, not Payload hooks** — project convention: all mutations go through `protectedAction()` in `src/lib/actions/`. The Sheets side effect lives there, not in `src/hooks/`.
> 2. **Reconciliation pattern, not outbox** — auto-push on create/cancel is fire-and-forget; a manual sync button on the kosztorys page is the durability mechanism. **Column I in the materiały tab stores `transferId`** as a deterministic join key, enabling preview→confirm diff.
> 3. **Two-phase sync button** — preview shows the diff (rows to append / delete / orphan), user confirms, then writes. Idempotent: re-checks col I per row before writing.
> 4. **Auto-provision on investment create** — `createInvestmentAction` fires Drive `files.copy` from the template and writes `googleSheetId`. Fire-and-forget; investment create succeeds even if Drive fails. **No backfill** for investments created before this lands.
> 5. **No materiały tab protection** — see TODO below.
> 6. **Route relocation** — kosztorys page lives under `/inwestycje/[id]/kosztorys`.
> 7. **Description column** — `${description} [YYYY-MM-DD]`. `transferId` is NOT embedded; it lives in column I.

---

## TODO — Deferred: materiały tab protection

**Decision deferred until after PoC trial.** The original plan applied an idempotent `addProtectedRange` on the materiały tab so only the service account could edit it (self-heal on every push). For the PoC we skip protection entirely. Materiały is editable by the owner and team in the iframe like any other tab.

**Why this needs careful consideration before re-enabling:**

- Protection covers the whole tab, including label cells (A2, E2 "Materiały budowlane/wykończeniowe") and SUM cells (B1, F1) — owner cannot adjust those without removing the protection.
- Self-heal-on-every-push means an owner intentionally removing the protection (to fix something) gets it back on the next transfer create; that may surprise more than help.
- Without protection, accidental edits to app-managed rows in materiały will happen and there is no audit trail — drift between Postgres `transactions` and the sheet's materiały rows is silent (the sync button preview catches it, but only when run).
- The owner trial **without** protection is itself the larger experiment: does the team's discipline / Drive sharing model handle this on its own, or is the lock genuinely needed?

**Re-evaluate after the one-week trial.** If owners report accidental edits to materiały, add protection back. The design sketch is preserved at the bottom of Task 2 ("DEFERRED — protection design notes") so the implementation is pre-thought.

---

## Prerequisites (user-owned, must be done before Task 1)

These are manual setup steps the engineer cannot do. Confirm these are complete before starting Task 1.

- [ ] **Google Cloud project** — pick or create one (owner's call where it lives)
- [ ] **APIs enabled in that project:** Google Sheets API **and Google Drive API** (both required — Sheets API for row append/delete, Drive API for auto-provisioning new sheets on investment creation)
- [ ] **Service account created** in IAM → Service Accounts → "Create"; no roles needed
- [ ] **Service account JSON key downloaded** (the full JSON file)
- [ ] **Template sheet** — clean kosztorys (no transactions, just the structure: tabs `kosztorys_robocizny`, `materiały ` with trailing space, `pokoje `, `Podsumowanie`, etc.). Owner-maintained, source of every new auto-provisioned sheet.
- [ ] **Template sheet shared with the service account email** at Editor access. (Editor needed — `drive.files.copy` requires read of the file and `files.create` parent permissions.)
- [ ] **Template sheet's file ID noted** (long string between `/d/` and `/edit` in the URL)
- [ ] **(Optional) Destination Drive folder** for all auto-provisioned sheets. Service account needs Editor on this folder.
- [ ] **Existing investment 31's sheet shared with the service account email** at Editor access. (For the PoC trial — investment 31 predates auto-provisioning; its sheet was made manually. Owner pastes its ID into investment 31's `googleSheetId` field after Task 4 lands.)
- [ ] **`.env` updated** with:

  ```
  GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...whole JSON...}'
  KOSZTORYS_TEMPLATE_SHEET_ID='1AbC...XyZ'
  # optional:
  KOSZTORYS_DRIVE_FOLDER_ID='1FoldERid...'
  ```

**No backfill for existing investments.** Investments created before auto-provisioning ships (everything except those created via `createInvestmentAction` after Task 7) will NOT auto-get a sheet. If the owner wants a sheet for an existing investment, they either:

- Paste an existing sheet ID into the `googleSheetId` field in admin (or via the banner's "Powiąż istniejący arkusz" CTA after Task 9), OR
- Click "Utwórz nowy kosztorys" on the banner — triggers the same `createKosztorysFromTemplate` used by auto-provision.

Investment 31 is the working example of the manual-paste path during the PoC trial.

Until all of these are checked, the build cannot complete Task 10 (E2E verification), and Tasks 2–9 cannot be smoke-tested against the real API.

---

## File Structure (decomposition decisions)

| File                                                           | Status           | Responsibility                                                                                         |
| -------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| `package.json`                                                 | modify           | Add `googleapis`                                                                                       |
| `src/lib/env.ts`                                               | modify           | Add `GOOGLE_SERVICE_ACCOUNT_JSON`, `KOSZTORYS_TEMPLATE_SHEET_ID`, optional `KOSZTORYS_DRIVE_FOLDER_ID` |
| `src/lib/google/sheets.ts`                                     | create           | Sheets client: `appendMaterialRow`, `deleteMaterialRowByTransferId`, `readMaterialyTransferIds`        |
| `src/lib/google/drive.ts`                                      | create           | Drive client: `createKosztorysFromTemplate`                                                            |
| `src/__tests__/lib/google/sheets.test.ts`                      | create           | Mocked unit tests                                                                                      |
| `src/__tests__/lib/google/drive.test.ts`                       | create           | Mocked unit tests                                                                                      |
| `src/migrations/{generated}.ts`                                | create           | Adds `google_sheet_id` column to `investments`                                                         |
| `src/collections/investments.ts`                               | modify           | Declares the `googleSheetId` field                                                                     |
| `src/lib/actions/sheets-sync.ts`                               | create           | `previewMaterialSync`, `applyMaterialSync`, `syncSingleTransferToSheet`                                |
| `src/lib/actions/transfers.ts`                                 | modify           | `createTransferAction` + `cancelTransferAction` fire single-row sync                                   |
| `src/lib/actions/investments.ts`                               | modify           | `createInvestmentAction` auto-provisions; new `provisionKosztorysAction` for the banner button         |
| `src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx`        | create           | Server: load investment, render iframe or unlinked CTA                                                 |
| `src/app/(frontend)/inwestycje/[id]/kosztorys/iframe-view.tsx` | create           | Client: iframe wrapper                                                                                 |
| `src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx` | create           | Client: sync button + preview dialog + confirm flow                                                    |
| `src/app/(frontend)/inwestycje/[id]/no-sheet-banner.tsx`       | create           | Client: banner shown when `googleSheetId` is empty                                                     |
| `src/app/(frontend)/inwestycje/[id]/layout.tsx`                | create or modify | Mount the banner at layout level                                                                       |

---

### Pre-Task-1: ✅ DONE — Univer/Blob spike removed (commit `a6089ef`, 2026-05-20)

Spike committed at `fcbf647` removed in commit `a6089ef`:

- Deleted: `src/app/(frontend)/kosztorys-spike/**`, `src/app/(frontend)/api/kosztorys/**`, `src/lib/kosztorys/**`, `src/hooks/transfers/append-material-to-kosztorys.ts`, `public/data/kosztorys-workbook.json`, `scripts/convert-kosztorys-xlsx.py`
- Uninstalled: `@univerjs/presets`, `@univerjs/preset-sheets-core`, `@vercel/blob` (direct dep; `@payloadcms/storage-vercel-blob` still pulls the transitive version for media uploads)
- Modified: `src/collections/transfers.ts` — removed `appendMaterialToKosztorys` import + array entry

---

### Task 1: Install googleapis + env validation

**Files:** `package.json`, `src/lib/env.ts`

- [ ] **Step 1: Install `googleapis`**

  ```bash
  pnpm add googleapis
  ```

- [ ] **Step 2: Add three env vars to the Zod schema**

  In `src/lib/env.ts`, near other third-party tokens:

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
  KOSZTORYS_TEMPLATE_SHEET_ID: z.string().min(1, 'KOSZTORYS_TEMPLATE_SHEET_ID is required'),
  KOSZTORYS_DRIVE_FOLDER_ID: z.string().optional(),
  ```

- [ ] **Step 3: Typecheck + boot dev to confirm env validates**

  ```bash
  pnpm typecheck
  pnpm dev   # kill after "Ready"
  ```

- [ ] **Step 4: Run `simplify` on the changes, then commit**

  ```bash
  git add package.json pnpm-lock.yaml src/lib/env.ts
  git commit -m "$(cat <<'EOF'
  add googleapis and validate Google env vars

  Env validation enforces JSON shape so a bad paste fails at startup,
  not at first hook invocation. Three vars added: service account JSON
  (Sheets+Drive auth), kosztorys template sheet id (source for Drive
  files.copy), and optional destination folder id.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2: Sheets client — `appendMaterialRow` + `deleteMaterialRowByTransferId` + `readMaterialyTransferIds`

**Files:** `src/lib/google/sheets.ts`, `src/__tests__/lib/google/sheets.test.ts`

Column layout in the `materiały ` tab (note trailing space):

- budowlane: A=label, B=amount (SUMs into B1), C=description, D=comment
- wykończeniowe: E=label, F=amount (SUMs into F1), G=description, H=settled
- **I = `transferId`** (NEW — written by app, used as join key for sync; same column for both kinds, since rows are independent ledgers but share row numbers)

**Append flow (two API calls):**

1. `values.append` to `'materiały '!B:C` (or `F:G`) with `[amount, "${description} [YYYY-MM-DD]"]`. The response's `updates.updatedRange` tells us the row number.
2. `values.update` on `'materiały '!I{row}` with `[transferId]`.

Splitting the writes (instead of one append across `B:I`) keeps columns D–H untouched, so any owner-typed content there survives.

- [ ] **Step 1: TDD — write the failing tests**

  Create `src/__tests__/lib/google/sheets.test.ts`. Mock `googleapis` similarly to:

  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest'

  const appendMock = vi.fn().mockResolvedValue({
    data: { updates: { updatedRange: "'materiały '!B5:C5" } },
  })
  const updateMock = vi.fn().mockResolvedValue({ data: {} })
  const getMock = vi.fn()
  const batchUpdateMock = vi.fn().mockResolvedValue({ data: {} })

  vi.mock('googleapis', () => ({
    google: {
      auth: { JWT: vi.fn().mockImplementation(() => ({})) },
      sheets: vi.fn().mockReturnValue({
        spreadsheets: {
          get: getMock,
          batchUpdate: batchUpdateMock,
          values: { append: appendMock, update: updateMock, get: getMock },
        },
      }),
    },
  }))

  beforeEach(() => {
    appendMock.mockClear()
    updateMock.mockClear()
    getMock.mockClear()
    batchUpdateMock.mockClear()
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: 'test@example.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIITEST\n-----END PRIVATE KEY-----\n',
    })
  })
  ```

  Test cases (write all of them, watch them fail):

  ```ts
  describe('appendMaterialRow', () => {
    it('writes [amount, "desc [date]"] to B:C and transferId to I for budowlane', async () => {
      const { appendMaterialRow } = await import('@/lib/google/sheets')
      const result = await appendMaterialRow('sheet-1', {
        kind: 'budowlane',
        amount: 100,
        description: 'cement',
        transferId: 2431,
        date: '2026-05-21',
      })

      expect(appendMock).toHaveBeenCalledTimes(1)
      const append = appendMock.mock.calls[0][0]
      expect(append.range).toBe("'materiały '!B:C")
      expect(append.valueInputOption).toBe('USER_ENTERED')
      expect(append.insertDataOption).toBe('INSERT_ROWS')
      expect(append.requestBody.values).toEqual([[100, 'cement [2026-05-21]']])

      expect(updateMock).toHaveBeenCalledTimes(1)
      const update = updateMock.mock.calls[0][0]
      expect(update.range).toBe("'materiały '!I5")
      expect(update.valueInputOption).toBe('RAW')
      expect(update.requestBody.values).toEqual([[2431]])

      expect(result).toEqual({ rowIndex: 5 })
    })

    it('writes to F:G for wykończeniowe', async () => {
      appendMock.mockResolvedValueOnce({
        data: { updates: { updatedRange: "'materiały '!F7:G7" } },
      })
      const { appendMaterialRow } = await import('@/lib/google/sheets')
      await appendMaterialRow('sheet-2', {
        kind: 'wykończeniowe',
        amount: 250.5,
        description: 'farba',
        transferId: 99,
        date: '2026-05-21',
      })
      expect(appendMock.mock.calls[0][0].range).toBe("'materiały '!F:G")
      expect(updateMock.mock.calls[0][0].range).toBe("'materiały '!I7")
    })
  })

  describe('readMaterialyTransferIds', () => {
    it('returns a Map<transferId, rowIndex>', async () => {
      getMock.mockResolvedValueOnce({
        data: { values: [[], [], [2431], [99], [], [777]] }, // rows 1..6, I-column
      })
      const { readMaterialyTransferIds } = await import('@/lib/google/sheets')
      const map = await readMaterialyTransferIds('sheet-3')
      expect(map.get(2431)).toBe(3)
      expect(map.get(99)).toBe(4)
      expect(map.get(777)).toBe(6)
      expect(map.size).toBe(3)
    })
  })

  describe('deleteMaterialRowByTransferId', () => {
    it('reads col I, finds the row, and deleteDimensions it', async () => {
      getMock.mockResolvedValueOnce({
        data: {
          sheets: [{ properties: { sheetId: 42, title: 'materiały ' } }],
        },
      })
      getMock.mockResolvedValueOnce({
        data: { values: [[], [], [2431], [99]] },
      })
      const { deleteMaterialRowByTransferId } = await import('@/lib/google/sheets')
      const result = await deleteMaterialRowByTransferId('sheet-4', 2431)
      expect(result).toEqual({ deleted: true, rowIndex: 3 })
      expect(batchUpdateMock).toHaveBeenCalledTimes(1)
      const req = batchUpdateMock.mock.calls[0][0].requestBody.requests[0]
      expect(req.deleteDimension.range).toEqual({
        sheetId: 42,
        dimension: 'ROWS',
        startIndex: 2, // 0-based; row 3 → startIndex 2
        endIndex: 3,
      })
    })

    it('returns { deleted: false } when transferId not found', async () => {
      getMock.mockResolvedValueOnce({
        data: { sheets: [{ properties: { sheetId: 42, title: 'materiały ' } }] },
      })
      getMock.mockResolvedValueOnce({ data: { values: [[], [], [2431]] } })
      const { deleteMaterialRowByTransferId } = await import('@/lib/google/sheets')
      const result = await deleteMaterialRowByTransferId('sheet-5', 9999)
      expect(result).toEqual({ deleted: false })
      expect(batchUpdateMock).not.toHaveBeenCalled()
    })
  })
  ```

  Run: `pnpm test -- src/__tests__/lib/google/sheets.test.ts` — expect FAIL.

- [ ] **Step 2: Implement the client**

  Create `src/lib/google/sheets.ts`:

  ```ts
  import { google, sheets_v4 } from 'googleapis'

  export type MaterialKindT = 'budowlane' | 'wykończeniowe'

  export type AppendMaterialInputT = {
    kind: MaterialKindT
    amount: number
    description: string
    transferId: number
    date: string // YYYY-MM-DD
  }

  const MATERIALY_TAB = 'materiały ' // trailing space matches source template
  const VALUE_COLUMNS: Record<MaterialKindT, string> = {
    budowlane: 'B:C',
    wykończeniowe: 'F:G',
  }
  const TRANSFER_ID_COLUMN = 'I'

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

  function parseRowFromRange(range: string): number {
    // e.g. "'materiały '!B5:C5" → 5
    const match = range.match(/!([A-Z]+)(\d+):/)
    if (!match) throw new Error(`could not parse row from range: ${range}`)
    return Number(match[2])
  }

  export async function appendMaterialRow(
    spreadsheetId: string,
    input: AppendMaterialInputT,
  ): Promise<{ rowIndex: number }> {
    const sheets = getClient()
    const valueRange = `'${MATERIALY_TAB}'!${VALUE_COLUMNS[input.kind]}`
    const descWithDate = `${input.description} [${input.date}]`

    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: valueRange,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[input.amount, descWithDate]] },
    })

    const updatedRange = appendRes.data.updates?.updatedRange
    if (!updatedRange) throw new Error('append response missing updatedRange')
    const rowIndex = parseRowFromRange(updatedRange)

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${MATERIALY_TAB}'!${TRANSFER_ID_COLUMN}${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[input.transferId]] },
    })

    return { rowIndex }
  }

  export async function readMaterialyTransferIds(
    spreadsheetId: string,
  ): Promise<Map<number, number>> {
    const sheets = getClient()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${MATERIALY_TAB}'!${TRANSFER_ID_COLUMN}:${TRANSFER_ID_COLUMN}`,
    })

    const map = new Map<number, number>()
    const values = res.data.values ?? []
    for (let i = 0; i < values.length; i++) {
      const cell = values[i]?.[0]
      if (cell === undefined || cell === '' || cell === null) continue
      const id = Number(cell)
      if (Number.isFinite(id)) map.set(id, i + 1) // 1-based row index
    }
    return map
  }

  export async function deleteMaterialRowByTransferId(
    spreadsheetId: string,
    transferId: number,
  ): Promise<{ deleted: boolean; rowIndex?: number }> {
    const sheets = getClient()

    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    const materialy = meta.data.sheets?.find((s) => s.properties?.title === MATERIALY_TAB)
    if (!materialy?.properties?.sheetId) {
      throw new Error(`materiały tab not found on ${spreadsheetId}`)
    }
    const sheetId = materialy.properties.sheetId

    const map = await readMaterialyTransferIds(spreadsheetId)
    const rowIndex = map.get(transferId)
    if (!rowIndex) return { deleted: false }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    })

    return { deleted: true, rowIndex }
  }
  ```

- [ ] **Step 3: Run tests until green**

  ```bash
  pnpm test -- src/__tests__/lib/google/sheets.test.ts
  ```

- [ ] **Step 4: `simplify` + commit**

  ```bash
  git add src/lib/google/sheets.ts src/__tests__/lib/google/sheets.test.ts
  git commit -m "$(cat <<'EOF'
  add Google Sheets client for materiały sync

  Three functions: appendMaterialRow (two API calls — values.append to
  B:C/F:G, then values.update to write transferId in column I; splitting
  the writes keeps cols D–H untouched), readMaterialyTransferIds
  (returns Map<transferId, rowIndex> for diff), and
  deleteMaterialRowByTransferId (lookup via col I, then deleteDimension).

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

**DEFERRED — protection design notes** (kept for the post-trial follow-up — see TODO at top):

If protection is re-enabled, add `ensureMaterialyProtection(sheetId)`: read existing protected ranges; if none has description `"Materiały: managed by app via API"`, call `batchUpdate` with `addProtectedRange.protectedRange = { description, warningOnly: false, range: { sheetId: <materialy.sheetId> }, editors: { users: [serviceAccountEmail] } }`. Idempotent. Call it from `appendMaterialRow` (before the append) so it self-heals on every push.

---

### Task 3: Drive client — `createKosztorysFromTemplate`

**Files:** `src/lib/google/drive.ts`, `src/__tests__/lib/google/drive.test.ts`

- [ ] **Step 1: TDD — failing tests**

  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest'

  const copyMock = vi.fn()
  vi.mock('googleapis', () => ({
    google: {
      auth: { JWT: vi.fn().mockImplementation(() => ({})) },
      drive: vi.fn().mockReturnValue({ files: { copy: copyMock } }),
    },
  }))

  beforeEach(() => {
    copyMock.mockReset()
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: 'test@example.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIITEST\n-----END PRIVATE KEY-----\n',
    })
    process.env.KOSZTORYS_TEMPLATE_SHEET_ID = 'template-id-abc'
    delete process.env.KOSZTORYS_DRIVE_FOLDER_ID
  })

  describe('createKosztorysFromTemplate', () => {
    it('copies the template, names it, returns the new id', async () => {
      copyMock.mockResolvedValueOnce({ data: { id: 'new-sheet-1' } })
      const { createKosztorysFromTemplate } = await import('@/lib/google/drive')
      const result = await createKosztorysFromTemplate('11 Listopada 40')
      expect(copyMock).toHaveBeenCalledWith({
        fileId: 'template-id-abc',
        requestBody: { name: 'Kosztorys – 11 Listopada 40' },
        fields: 'id',
      })
      expect(result).toEqual({ sheetId: 'new-sheet-1' })
    })

    it('places the copy into the destination folder if KOSZTORYS_DRIVE_FOLDER_ID is set', async () => {
      process.env.KOSZTORYS_DRIVE_FOLDER_ID = 'folder-id-xyz'
      copyMock.mockResolvedValueOnce({ data: { id: 'new-sheet-2' } })
      const { createKosztorysFromTemplate } = await import('@/lib/google/drive')
      await createKosztorysFromTemplate('Kasprzaka 9')
      expect(copyMock.mock.calls[0][0].requestBody.parents).toEqual(['folder-id-xyz'])
    })

    it('throws if Drive returns no id', async () => {
      copyMock.mockResolvedValueOnce({ data: {} })
      const { createKosztorysFromTemplate } = await import('@/lib/google/drive')
      await expect(createKosztorysFromTemplate('X')).rejects.toThrow(/no file id/)
    })
  })
  ```

- [ ] **Step 2: Implement**

  ```ts
  // src/lib/google/drive.ts
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

- [ ] **Step 3: Tests green, `simplify`, commit**

  ```bash
  git add src/lib/google/drive.ts src/__tests__/lib/google/drive.test.ts
  git commit -m "$(cat <<'EOF'
  add Google Drive client for kosztorys provisioning

  createKosztorysFromTemplate calls drive.files.copy on the template,
  renames the copy to "Kosztorys – {investmentName}", optionally places
  it under KOSZTORYS_DRIVE_FOLDER_ID. Drive scope is 'drive.file' —
  narrower than full drive, the service account can only see files it
  created or that were shared with it.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 4: Add `googleSheetId` field to Investments

**Files:** `src/collections/investments.ts`, `src/migrations/{auto-named}.ts`

Per CLAUDE.md: always `pnpm migrate:create` first.

- [ ] **Step 1: Add the field to the collection**

  In `src/collections/investments.ts`, append to the `fields:` array (after `status`):

  ```ts
  {
    name: 'googleSheetId',
    type: 'text',
    label: { en: 'Google Sheet ID', pl: 'ID arkusza Google' },
    admin: {
      description: {
        en: 'Long string between /d/ and /edit in the sheet URL. Used to embed the sheet and to push transfers via Sheets API. Auto-set on investment create; can be pasted manually for existing investments.',
        pl: 'Długi ciąg pomiędzy /d/ a /edit w URL arkusza. Używane do osadzenia arkusza i wysyłania transakcji przez Sheets API. Ustawiane automatycznie przy tworzeniu inwestycji; można wkleić ręcznie dla istniejących inwestycji.',
      },
    },
  }
  ```

  Not required — investments without a sheet still function in the rest of the app (the banner from Task 9 surfaces the gap).

- [ ] **Step 2: Generate the migration**

  ```bash
  pnpm migrate:create
  ```

  Name: `add-google-sheet-id-to-investments`. Read the generated file; it should contain a single `ALTER TABLE` on `investments`. If it includes unrelated changes, abort and investigate.

- [ ] **Step 3: Apply locally + regen types**

  ```bash
  pnpm dev          # waits for "Ready" — migrate runs on boot; kill after
  pnpm generate:types
  pnpm typecheck
  ```

- [ ] **Step 4: `simplify` + commit**

  ```bash
  git add src/collections/investments.ts src/migrations/
  git commit -m "$(cat <<'EOF'
  add googleSheetId field to Investments

  Stores the long string between /d/ and /edit in the Sheets URL. Used
  by the kosztorys iframe view and the sync server actions. Auto-set
  during investment create (Task 7); manual paste path stays open for
  investments created before that lands.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 5: Reconciler — `sheets-sync` server actions

**Files:** `src/lib/actions/sheets-sync.ts`

Three exports:

- `previewMaterialSync(investmentId)` — read-only diff between Postgres and the sheet for that investment. Returns `{ toAppend, toDelete, orphans }`.
- `applyMaterialSync(investmentId, preview)` — executes the previewed diff; idempotent (re-checks col I per row).
- `syncSingleTransferToSheet(params)` — called from Task 6's transfer create/cancel paths; either appends or deletes one row.

The single-transfer function and the bulk applier share `appendMaterialRow` + `deleteMaterialRowByTransferId`.

- [ ] **Step 1: Create the file**

  ```ts
  // src/lib/actions/sheets-sync.ts
  'use server'

  import { getPayload } from 'payload'
  import config from '@payload-config'
  import {
    appendMaterialRow,
    deleteMaterialRowByTransferId,
    readMaterialyTransferIds,
    type MaterialKindT,
  } from '@/lib/google/sheets'
  import { protectedAction } from './utils'

  const MATERIAL_CATEGORY_KIND: Record<string, MaterialKindT> = {
    'Materiały budowlane': 'budowlane',
    'Materiały wykończeniowe': 'wykończeniowe',
  }

  type AppRowT = {
    transferId: number
    kind: MaterialKindT
    amount: number
    description: string
    date: string // YYYY-MM-DD
  }

  type ToAppendT = AppRowT
  type ToDeleteT = { transferId: number; rowIndex: number }
  type OrphanT = { transferIdInSheet: number; rowIndex: number }

  export type MaterialSyncPreviewT = {
    toAppend: ToAppendT[]
    toDelete: ToDeleteT[]
    orphans: OrphanT[]
    spreadsheetId: string
  }

  async function loadAppMaterialRows(
    payload: Awaited<ReturnType<typeof getPayload>>,
    investmentId: number,
  ): Promise<AppRowT[]> {
    const result = await payload.find({
      collection: 'transactions',
      where: {
        and: [
          { investment: { equals: investmentId } },
          { type: { equals: 'INVESTMENT_EXPENSE' } },
          { cancelled: { not_equals: true } },
        ],
      },
      depth: 1,
      limit: 1000,
      overrideAccess: true,
    })

    const rows: AppRowT[] = []
    for (const t of result.docs) {
      const categoryName =
        typeof t.expenseCategory === 'object' && t.expenseCategory !== null
          ? (t.expenseCategory as { name?: string }).name
          : undefined
      if (!categoryName) continue
      const kind = MATERIAL_CATEGORY_KIND[categoryName]
      if (!kind) continue

      rows.push({
        transferId: t.id,
        kind,
        amount: Number(t.amount),
        description: t.description ?? '',
        date: t.date ? new Date(t.date).toISOString().slice(0, 10) : '',
      })
    }
    return rows
  }

  export async function previewMaterialSync(investmentId: number) {
    return protectedAction(
      'previewMaterialSync',
      async ({ payload }) => {
        const investment = await payload.findByID({
          collection: 'investments',
          id: investmentId,
          overrideAccess: true,
        })
        if (!investment?.googleSheetId) {
          return { error: 'Inwestycja nie ma powiązanego arkusza Google.' }
        }
        const sheetId = investment.googleSheetId

        const [appRows, sheetIds] = await Promise.all([
          loadAppMaterialRows(payload, investmentId),
          readMaterialyTransferIds(sheetId),
        ])

        const appIds = new Set(appRows.map((r) => r.transferId))
        const toAppend = appRows.filter((r) => !sheetIds.has(r.transferId))
        const toDelete: ToDeleteT[] = []
        const orphans: OrphanT[] = []

        for (const [transferId, rowIndex] of sheetIds.entries()) {
          if (appIds.has(transferId)) continue
          // present in sheet, not in active app rows — either cancelled or never existed
          const probe = await payload.findByID({
            collection: 'transactions',
            id: transferId,
            disableErrors: true,
            overrideAccess: true,
          })
          if (probe) {
            toDelete.push({ transferId, rowIndex })
          } else {
            orphans.push({ transferIdInSheet: transferId, rowIndex })
          }
        }

        const preview: MaterialSyncPreviewT = {
          toAppend,
          toDelete,
          orphans,
          spreadsheetId: sheetId,
        }
        return { success: true, data: preview }
      },
      [],
    )
  }

  export async function applyMaterialSync(investmentId: number, preview: MaterialSyncPreviewT) {
    return protectedAction(
      'applyMaterialSync',
      async ({ payload }) => {
        const investment = await payload.findByID({
          collection: 'investments',
          id: investmentId,
          overrideAccess: true,
        })
        if (!investment?.googleSheetId || investment.googleSheetId !== preview.spreadsheetId) {
          return { error: 'Powiązanie arkusza zmieniło się — uruchom podgląd ponownie.' }
        }
        const sheetId = investment.googleSheetId

        const current = await readMaterialyTransferIds(sheetId)
        let added = 0
        let deleted = 0
        let skipped = 0
        const errors: Array<{ transferId: number; message: string }> = []

        for (const row of preview.toAppend) {
          if (current.has(row.transferId)) {
            skipped++
            continue
          }
          try {
            await appendMaterialRow(sheetId, row)
            added++
          } catch (err) {
            errors.push({ transferId: row.transferId, message: String(err) })
          }
        }

        for (const row of preview.toDelete) {
          // re-read fresh — earlier appends may have shifted indices
          try {
            const res = await deleteMaterialRowByTransferId(sheetId, row.transferId)
            if (res.deleted) deleted++
            else skipped++
          } catch (err) {
            errors.push({ transferId: row.transferId, message: String(err) })
          }
        }

        return { success: true, data: { added, deleted, skipped, errors } }
      },
      ['transactions'],
    )
  }

  /**
   * Single-transfer sync, called fire-and-forget from create/cancel server actions.
   * intent='CREATE' → append if not already present. intent='DELETE' → delete if present.
   */
  export async function syncSingleTransferToSheet(params: {
    transferId: number
    intent: 'CREATE' | 'DELETE'
  }): Promise<void> {
    try {
      const payload = await getPayload({ config })

      const transfer = await payload.findByID({
        collection: 'transactions',
        id: params.transferId,
        depth: 1,
        overrideAccess: true,
      })
      if (!transfer) return
      if (transfer.type !== 'INVESTMENT_EXPENSE') return

      const investmentId =
        typeof transfer.investment === 'number'
          ? transfer.investment
          : (transfer.investment as { id: number } | null)?.id
      if (!investmentId) return

      const investment = await payload.findByID({
        collection: 'investments',
        id: investmentId,
        overrideAccess: true,
      })
      const sheetId = investment?.googleSheetId
      if (!sheetId) {
        console.log(
          `[sheets-sync] skip transfer #${params.transferId}: investment #${investmentId} has no googleSheetId`,
        )
        return
      }

      if (params.intent === 'DELETE') {
        const res = await deleteMaterialRowByTransferId(sheetId, params.transferId)
        console.log(
          `[sheets-sync] delete transfer #${params.transferId} → sheet ${sheetId} (deleted=${res.deleted})`,
        )
        return
      }

      const categoryName =
        typeof transfer.expenseCategory === 'object' && transfer.expenseCategory !== null
          ? (transfer.expenseCategory as { name?: string }).name
          : undefined
      const kind = categoryName ? MATERIAL_CATEGORY_KIND[categoryName] : undefined
      if (!kind) return

      const existing = await readMaterialyTransferIds(sheetId)
      if (existing.has(params.transferId)) return // idempotent — already there

      await appendMaterialRow(sheetId, {
        kind,
        amount: Number(transfer.amount),
        description: transfer.description ?? '',
        transferId: params.transferId,
        date: transfer.date ? new Date(transfer.date).toISOString().slice(0, 10) : '',
      })
      console.log(
        `[sheets-sync] append transfer #${params.transferId} → sheet ${sheetId} (${kind})`,
      )
    } catch (err) {
      console.error('[sheets-sync] failed (non-fatal):', err)
    }
  }
  ```

- [ ] **Step 2: Typecheck + `simplify` + commit**

  ```bash
  pnpm typecheck
  git add src/lib/actions/sheets-sync.ts
  git commit -m "$(cat <<'EOF'
  add sheets-sync reconciler server actions

  Three exports: previewMaterialSync (read-only diff), applyMaterialSync
  (idempotent execute — re-checks col I per row in case state shifted
  between preview and confirm), and syncSingleTransferToSheet (used by
  the transfer create/cancel auto-push path). All three share the same
  underlying Sheets client functions; the bulk apply is just the
  single-transfer call generalized.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6: Wire single-row sync into create/cancel transfer actions

**Files:** `src/lib/actions/transfers.ts`

Fire-and-forget. Sheets failures log but never fail the action.

- [ ] **Step 1: Read the current actions**

  Read `src/lib/actions/transfers.ts`. Locate `createTransferAction` (line ~26), `createBulkTransferAction` (line ~72), `cancelTransferAction` (line ~184).

- [ ] **Step 2: After `payload.create` in `createTransferAction`, fire `syncSingleTransferToSheet`**

  ```ts
  import { syncSingleTransferToSheet } from './sheets-sync'

  // inside createTransferAction, after payload.create:
  const created = await payload.create({
    collection: 'transactions',
    data: { ...parsed, createdBy: user.id /* ... */ },
  })
  // ...

  void syncSingleTransferToSheet({ transferId: created.id, intent: 'CREATE' })
  ```

  The `void` matters — `await` would block the user-visible action on Sheets API latency.

- [ ] **Step 3: Same pattern in `createBulkTransferAction`**

  Each successful `payload.create` in the loop fires its own `void syncSingleTransferToSheet({ transferId: created.id, intent: 'CREATE' })`. Don't batch — each row independently decides whether it's a Materiały item.

- [ ] **Step 4: In `cancelTransferAction`, fire `intent: 'DELETE'` after the `cancelled: true` update**

  ```ts
  // after payload.update marking cancelled: true
  void syncSingleTransferToSheet({ transferId, intent: 'DELETE' })
  ```

- [ ] **Step 5: Typecheck, `simplify`, commit**

  ```bash
  pnpm typecheck
  git add src/lib/actions/transfers.ts
  git commit -m "$(cat <<'EOF'
  sync transfer create/cancel to Google Sheet from the server actions

  createTransferAction, createBulkTransferAction, and cancelTransferAction
  now fire-and-forget a single-transfer sync after the DB mutation
  succeeds. INVESTMENT_EXPENSE + Materiały budowlane/wykończeniowe with
  a linked googleSheetId → append on create, delete on cancel. Sheets
  failures log but never fail the action; drift is recoverable via the
  sync button (Task 8).

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7: Auto-provision sheet on investment create + manual-provision action

**Files:** `src/lib/actions/investments.ts`

Two changes:

1. `createInvestmentAction` fires `createKosztorysFromTemplate` after `payload.create`, then writes the resulting `googleSheetId` back to the investment.
2. New exported action `provisionKosztorysAction(investmentId)` — called by the banner's "Utwórz nowy kosztorys" CTA for existing investments without sheets.

Both fire-and-forget on the Drive call so the user-visible action doesn't block.

- [ ] **Step 1: Add the auto-provision side effect to `createInvestmentAction`**

  In `src/lib/actions/investments.ts`:

  ```ts
  import { createKosztorysFromTemplate } from '@/lib/google/drive'

  // inside createInvestmentAction, after payload.create:
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

- [ ] **Step 2: Add `provisionKosztorysAction` for the banner button**

  Synchronous (returns success only after the Drive call lands, so the banner UI knows when to refresh). Uses `protectedAction`:

  ```ts
  export async function provisionKosztorysAction(investmentId: number) {
    return protectedAction(
      'provisionKosztorysAction',
      async ({ payload }) => {
        const investment = await payload.findByID({
          collection: 'investments',
          id: investmentId,
          overrideAccess: true,
        })
        if (!investment) return { error: 'Inwestycja nie istnieje.' }
        if (investment.googleSheetId) {
          return { error: 'Ta inwestycja ma już powiązany arkusz.' }
        }

        const { sheetId } = await createKosztorysFromTemplate(investment.name)
        await payload.update({
          collection: 'investments',
          id: investmentId,
          data: { googleSheetId: sheetId },
          overrideAccess: true,
        })

        return { success: true, data: { sheetId } }
      },
      ['investments'],
    )
  }
  ```

  Unlike the auto-provision case, this one DOES wait — the user is staring at a button waiting for feedback.

- [ ] **Step 3: Typecheck, `simplify`, commit**

  ```bash
  pnpm typecheck
  git add src/lib/actions/investments.ts
  git commit -m "$(cat <<'EOF'
  auto-provision kosztorys sheet on investment create + manual button action

  createInvestmentAction now fires a fire-and-forget Drive files.copy
  after payload.create and writes googleSheetId back. Failure logs but
  never blocks the create. provisionKosztorysAction is the synchronous
  counterpart wired to the "Utwórz nowy kosztorys" banner button (Task
  9) for existing investments — same Drive call, but awaited so the
  button can show a result.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 8: `/inwestycje/[id]/kosztorys` page — iframe + sync button + preview dialog

**Files:**

- `src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx`
- `src/app/(frontend)/inwestycje/[id]/kosztorys/iframe-view.tsx`
- `src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx`

- [ ] **Step 1: Server page**

  ```tsx
  // page.tsx
  import { notFound } from 'next/navigation'
  import { getInvestment } from '@/lib/queries/investments'
  import { KosztorysIframeView } from './iframe-view'
  import { SyncButton } from './sync-button'

  export default async function KosztorysPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const investmentId = Number(id)
    if (!Number.isFinite(investmentId) || investmentId <= 0) notFound()

    const investment = await getInvestment(id)
    if (!investment) notFound()

    if (!investment.googleSheetId) {
      // banner from Task 9 already covers this state at the layout level;
      // page renders nothing extra so the banner isn't doubled
      return null
    }

    return (
      <KosztorysIframeView
        sheetId={investment.googleSheetId}
        investmentName={investment.name}
        investmentId={investmentId}
        toolbar={<SyncButton investmentId={investmentId} />}
      />
    )
  }
  ```

- [ ] **Step 2: Iframe view**

  ```tsx
  // iframe-view.tsx
  'use client'
  import type { ReactNode } from 'react'

  type Props = {
    sheetId: string
    investmentName: string
    investmentId: number
    toolbar?: ReactNode
  }

  export function KosztorysIframeView({ sheetId, investmentName, investmentId, toolbar }: Props) {
    const src = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing&rm=embedded&embedded=true`
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        <div className="border-border flex flex-wrap items-center justify-between gap-4 border-b px-4 py-2">
          <div className="flex flex-col">
            <h1 className="text-foreground text-sm font-medium">Kosztorys — {investmentName}</h1>
            <span className="text-muted-foreground text-xs">
              Google Sheets · inwestycja #{investmentId}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {toolbar}
            <a
              href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground text-xs underline"
            >
              Otwórz w Sheets ↗
            </a>
          </div>
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

- [ ] **Step 3: Sync button with preview dialog**

  Two-phase: button → preview action → dialog with diff → confirm → apply action → toast.

  ```tsx
  // sync-button.tsx
  'use client'
  import { useState, useTransition } from 'react'
  import { Button } from '@/components/ui/button'
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
  } from '@/components/ui/dialog'
  import { previewMaterialSync, applyMaterialSync } from '@/lib/actions/sheets-sync'
  import type { MaterialSyncPreviewT } from '@/lib/actions/sheets-sync'
  import { toast } from 'sonner'

  export function SyncButton({ investmentId }: { investmentId: number }) {
    const [preview, setPreview] = useState<MaterialSyncPreviewT | null>(null)
    const [pending, startTransition] = useTransition()

    const onCheck = () => {
      startTransition(async () => {
        const res = await previewMaterialSync(investmentId)
        if ('error' in res) {
          toast.error(res.error)
          return
        }
        setPreview(res.data)
      })
    }

    const onConfirm = () => {
      if (!preview) return
      startTransition(async () => {
        const res = await applyMaterialSync(investmentId, preview)
        if ('error' in res) {
          toast.error(res.error)
          return
        }
        const { added, deleted, skipped, errors } = res.data
        toast.success(
          `Synchronizacja: +${added} / −${deleted} / pominięto ${skipped}${
            errors.length ? ` · błędy: ${errors.length}` : ''
          }`,
        )
        setPreview(null)
      })
    }

    return (
      <>
        <Button size="sm" variant="outline" onClick={onCheck} disabled={pending}>
          {pending ? 'Sprawdzam…' : 'Sprawdź synchronizację'}
        </Button>
        <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Podgląd zmian w arkuszu</DialogTitle>
            </DialogHeader>
            {preview && (
              <div className="space-y-4 text-sm">
                <Section
                  title={`Do dodania (${preview.toAppend.length})`}
                  tone="green"
                  items={preview.toAppend.map((r) => ({
                    key: r.transferId,
                    text: `#${r.transferId} · ${r.kind} · ${r.amount} zł · ${r.description} [${r.date}]`,
                  }))}
                />
                <Section
                  title={`Do usunięcia (${preview.toDelete.length})`}
                  tone="red"
                  items={preview.toDelete.map((r) => ({
                    key: r.transferId,
                    text: `#${r.transferId} · wiersz ${r.rowIndex}`,
                  }))}
                />
                <Section
                  title={`Sieroty w arkuszu (${preview.orphans.length})`}
                  tone="yellow"
                  items={preview.orphans.map((o) => ({
                    key: o.transferIdInSheet,
                    text: `transferId #${o.transferIdInSheet} (wiersz ${o.rowIndex}) — brak w bazie; pozostaje bez zmian`,
                  }))}
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Anuluj
              </Button>
              <Button onClick={onConfirm} disabled={pending}>
                Zatwierdź zmiany
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  function Section({
    title,
    tone,
    items,
  }: {
    title: string
    tone: 'green' | 'red' | 'yellow'
    items: Array<{ key: number; text: string }>
  }) {
    const dot = { green: 'bg-emerald-500', red: 'bg-red-500', yellow: 'bg-amber-500' }[tone]
    return (
      <div>
        <div className="mb-1 flex items-center gap-2 font-medium">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {title}
        </div>
        {items.length === 0 ? (
          <div className="text-muted-foreground pl-4 text-xs">— brak —</div>
        ) : (
          <ul className="text-muted-foreground space-y-0.5 pl-4 text-xs">
            {items.map((i) => (
              <li key={i.key}>{i.text}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }
  ```

  Note on orphans: shown but NOT acted on. They likely represent owner-typed-by-hand rows in the materiały tab (without a `transferId`) — we don't auto-delete those. Future: surface a "Convert to transfer?" action.

- [ ] **Step 4: Typecheck, manual smoke (page loads), `simplify`, commit**

  ```bash
  git add 'src/app/(frontend)/inwestycje/[id]/kosztorys/'
  git commit -m "$(cat <<'EOF'
  add /inwestycje/[id]/kosztorys iframe view + sync button

  Server page renders the iframe (rm=embedded URL) when googleSheetId is
  set; renders nothing when unset since the layout banner (Task 9)
  covers that state. Sync button drives a two-phase preview→confirm
  flow against the sheets-sync server actions: dialog shows toAppend
  (green), toDelete (red), orphans (yellow); confirm fires
  applyMaterialSync. Orphans surfaced but not touched — they likely
  are owner-typed rows.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 9: Unlinked-investment banner on `/inwestycje/[id]/*`

**Files:**

- `src/app/(frontend)/inwestycje/[id]/layout.tsx` (create if absent, modify if present)
- `src/app/(frontend)/inwestycje/[id]/no-sheet-banner.tsx`

Banner shows whenever the URL is under `/inwestycje/[id]/*` AND that investment has no `googleSheetId`. Two CTAs side by side.

- [ ] **Step 1: Server layout fetches the investment**

  ```tsx
  // layout.tsx
  import { notFound } from 'next/navigation'
  import { getInvestment } from '@/lib/queries/investments'
  import { NoSheetBanner } from './no-sheet-banner'

  export default async function InvestmentLayout({
    params,
    children,
  }: {
    params: Promise<{ id: string }>
    children: React.ReactNode
  }) {
    const { id } = await params
    const investment = await getInvestment(id)
    if (!investment) notFound()

    return (
      <>
        {!investment.googleSheetId && (
          <NoSheetBanner investmentId={investment.id} investmentName={investment.name} />
        )}
        {children}
      </>
    )
  }
  ```

  If a `layout.tsx` already exists at this path, merge the banner mount into it instead of overwriting.

- [ ] **Step 2: Banner client component with two CTAs**

  ```tsx
  // no-sheet-banner.tsx
  'use client'
  import { useState, useTransition } from 'react'
  import Link from 'next/link'
  import { useRouter } from 'next/navigation'
  import { Button } from '@/components/ui/button'
  import { provisionKosztorysAction } from '@/lib/actions/investments'
  import { toast } from 'sonner'

  type Props = { investmentId: number; investmentName: string }

  export function NoSheetBanner({ investmentId, investmentName }: Props) {
    const [pending, startTransition] = useTransition()
    const router = useRouter()

    const onProvision = () => {
      startTransition(async () => {
        const res = await provisionKosztorysAction(investmentId)
        if ('error' in res) {
          toast.error(res.error)
          return
        }
        toast.success(`Utworzono kosztorys dla "${investmentName}".`)
        router.refresh()
      })
    }

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span>
          Inwestycja <strong>{investmentName}</strong> nie ma jeszcze powiązanego kosztorysu.
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/collections/investments/${investmentId}`}>
              Powiąż istniejący arkusz
            </Link>
          </Button>
          <Button size="sm" onClick={onProvision} disabled={pending}>
            {pending ? 'Tworzę…' : 'Utwórz nowy kosztorys'}
          </Button>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 3: Typecheck, manual smoke, `simplify`, commit**

  ```bash
  git add 'src/app/(frontend)/inwestycje/[id]/'
  git commit -m "$(cat <<'EOF'
  add unlinked-investment banner across /inwestycje/[id]/*

  Layout mounts NoSheetBanner whenever the route's investment has no
  googleSheetId. Banner offers two CTAs side by side: link to admin to
  paste an existing sheet ID, or one-click create via
  provisionKosztorysAction (Task 7). router.refresh after provision so
  the banner disappears.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 10: End-to-end manual verification

No code — integration check, gates the one-week owner trial. All steps require user-owned Prerequisites to be complete.

- [ ] **Step 1: Boot dev**

  ```bash
  pnpm dev
  ```

  Confirm env validation passes at boot (no errors about `GOOGLE_SERVICE_ACCOUNT_JSON` / `KOSZTORYS_TEMPLATE_SHEET_ID`).

- [ ] **Step 2: Verify investment 31 unlinked-banner state**

  Open `http://localhost:3001/inwestycje/31/kosztorys`. Confirm: amber banner at top with **"Powiąż istniejący arkusz"** + **"Utwórz nowy kosztorys"** buttons. Page body is empty (per Task 8 step 1 — banner is the whole story).

- [ ] **Step 3: Test the "Powiąż istniejący arkusz" path on investment 31**

  Click "Powiąż istniejący arkusz" → admin opens → paste investment 31's sheet ID into `googleSheetId` → Save → back to `/inwestycje/31/kosztorys`. Confirm: banner gone, iframe loads the live sheet with the "Kosztorys — 11 Listopada 40" header and "Sprawdź synchronizację" button.

- [ ] **Step 4: Create a Wydatek and watch auto-push**

  In a second tab, dashboard → Wydatek → Wydatek inwestycyjny → Inwestycja: 11 Listopada 40 → any active kasa → Kwota: 150 → Opis: "e2e test" → Typ: Materiały budowlane → Dodaj. Switch to iframe tab. Within ~3s, a new row appears in materiały: B=150, C="e2e test [YYYY-MM-DD]", I=<transferId>.

  Dev server log should show: `[sheets-sync] append transfer #N → sheet S (budowlane)`.

- [ ] **Step 5: Cancel that Wydatek and watch the row disappear**

  Find the transfer in the transactions list. Cancel it. Dev log: `[sheets-sync] delete transfer #N → sheet S (deleted=true)`. Iframe tab: the row is removed from materiały.

- [ ] **Step 6: Test the sync button preview+confirm**

  Create 2–3 more Materiały transfers but block one of the auto-pushes (easiest: temporarily set `KOSZTORYS_TEMPLATE_SHEET_ID` to an invalid value to force a Drive failure path… better: directly delete a row from materiały via the iframe to create drift). Click "Sprawdź synchronizację" → dialog opens listing the drift. Click "Zatwierdź zmiany". Toast confirms `+1 / −0 / pominięto 0`. Iframe tab shows the row back.

- [ ] **Step 7: Test auto-provision on a NEW investment**

  Create a new investment via the app's normal flow with name "Test 21 Maja". Within a few seconds, the `googleSheetId` field on that investment should be populated. Open `/inwestycje/{new-id}/kosztorys` → empty-template iframe loads.

  Dev log: `[kosztorys-provision] investment #N → sheet provisioned`.

- [ ] **Step 8: Test the "Utwórz nowy kosztorys" banner button**

  Find an existing investment without a `googleSheetId` (any other than 31). Open `/inwestycje/{id}/kosztorys`. Click "Utwórz nowy kosztorys". Within a few seconds: toast success, banner disappears, iframe loads the fresh template.

- [ ] **Step 9: Hand off to owner for one-week trial**

  Success criteria for the trial:
  1. Owner edits robocizny / pokoje in investment 31's iframe; changes persist and are visible to teammates with Drive access.
  2. Creating Materiały Wydatki in the app appears in materiały tab within seconds (auto-push).
  3. Cancelling such Wydatki removes the row from materiały within seconds (auto-push).
  4. Sync button preview accurately reflects drift; confirm reconciles.
  5. New investments auto-get a sheet.
  6. Owner does NOT accidentally edit app-managed materiały rows. If they do, document the incident — it's the signal for re-enabling protection (TODO at top of plan).
  7. File → Download as xlsx, File → Print, version history, mobile editing all work via Sheets.

  Document rough edges for the post-trial decision.

---

## Self-Review Checklist

- [ ] Every prerequisite is owned by a human and clearly marked as such
- [ ] Every task lists exact file paths
- [ ] Every code-changing step contains real code (no "implement here" placeholders)
- [ ] Test expectations are concrete
- [ ] Types referenced in later tasks match earlier definitions (`MaterialKindT`, `MaterialSyncPreviewT`, etc.)
- [ ] The plan stands alone without this conversation's context
- [ ] Each task includes a `simplify` step before commit (per project workflow)
- [ ] PoC success criteria from the decision brief are reachable from Task 10

---

## After this plan

PoC enters a one-week owner trial. During the trial:

- **Do not modify** `sheets.ts`, `drive.ts`, `sheets-sync.ts`, or the auto-push wiring — let the owner experience the unchanged behavior so feedback is meaningful.
- Capture owner-reported rough edges in a follow-up doc, not patches.
- After the week, decide:
  - **Ship to other investments** (already automatic via Task 7 — just stop pasting manually).
  - **Re-enable protection** (Task 2's deferred design notes).
  - **Drop one of the banner CTAs** (link or create) per owner preference, per the user's note that both were shipped to learn which sticks.
  - **Address orphan rows** if they pile up — add a "Convert orphan to transfer" affordance in the sync dialog.

Do NOT push the branch without explicit owner authorization. PR creation at the very end, also pending explicit authorization.
