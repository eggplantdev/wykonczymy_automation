import { afterAll, beforeAll, vi, type Mock } from 'vitest'
import { resetAuthState } from '@/__tests__/stubs/get-current-user-jwt'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

// Pass-through seams a spec steers with `vi.mocked(fn)` to fail one write mid-transaction — a
// per-file `vi.mock` would move the spec out of `db-shared`.
const { seams, passThrough } = vi.hoisted(() => {
  // On `globalThis`: this file and its factories re-run for every `db-shared` file, while a module
  // cached by an earlier file keeps the seam it imported then — a fresh `vi.fn` per file would leave
  // the spec steering a different instance than the code under test calls.
  const registry = globalThis as {
    dbSeams?: { modules: Map<string, Record<string, unknown>>; seams: Mock[] }
  }
  const { modules, seams } = (registry.dbSeams ??= { modules: new Map(), seams: [] as Mock[] })
  const passThrough = async (
    importOriginal: () => Promise<Record<string, unknown>>,
    ...names: string[]
  ) => {
    const key = names.join()
    if (!modules.has(key)) {
      const actual = await importOriginal()
      const wrapped = names.map((name) => {
        const seam = vi.fn(actual[name] as (...args: unknown[]) => unknown)
        seams.push(seam)
        return [name, seam]
      })
      modules.set(key, { ...actual, ...Object.fromEntries(wrapped) })
    }
    return modules.get(key)!
  }
  return { seams, passThrough }
})

vi.mock('@/lib/db/worker-reports', (importOriginal) => passThrough(importOriginal, 'settleReport'))
vi.mock('@/lib/kosztorys/templates/serialize-template', (importOriginal) =>
  passThrough(importOriginal, 'serializeTemplate'),
)
vi.mock('@/lib/kosztorys/work-catalogue/write-catalogue-entry', (importOriginal) =>
  passThrough(importOriginal, 'applyCatalogueWrite'),
)
vi.mock('@/lib/kosztorys/work-catalogue/place-catalogue-items', (importOriginal) =>
  passThrough(importOriginal, 'placeCatalogueItems'),
)
vi.mock('@/lib/kosztorys/serialize-kosztorys', (importOriginal) =>
  passThrough(importOriginal, 'serializeKosztorys'),
)
vi.mock('@/lib/kosztorys/seed-from-preset', (importOriginal) =>
  passThrough(importOriginal, 'seedInvestmentFromPreset'),
)
// External services: still pass-through, so a spec that steers one sets its own result first —
// the per-file reset hands back the real network call.
vi.mock('@/lib/ai/translate', (importOriginal) =>
  passThrough(importOriginal, 'translateTexts', 'translateToPolish'),
)
vi.mock('@/lib/ai/openrouter', (importOriginal) =>
  passThrough(importOriginal, 'extractReceipt', 'extractReceipts'),
)
vi.mock('@/lib/google/sheet-lookup', (importOriginal) =>
  passThrough(importOriginal, 'getInvestmentSheet'),
)
vi.mock('@/lib/google/readonly-sheets-client', (importOriginal) =>
  passThrough(importOriginal, 'getReadonlySheetsClient'),
)
vi.mock('@/lib/kosztorys/sheet-import/read-sheet', (importOriginal) =>
  passThrough(importOriginal, 'readImportGrids'),
)
vi.mock('@/lib/media/blob-public-url', (importOriginal) =>
  passThrough(importOriginal, 'fetchMediaBytes'),
)
vi.mock('@/lib/media/delete-unreferenced-media', (importOriginal) =>
  passThrough(importOriginal, 'reclaimUnreferencedMedia'),
)
vi.mock('@/lib/actions/sheets-sync', (importOriginal) =>
  passThrough(importOriginal, 'syncBulkExpensesToSheet'),
)
vi.mock('@/lib/push/notify-pending-payouts', (importOriginal) =>
  passThrough(importOriginal, 'notifyPendingPayouts'),
)

// `db-shared` keeps one module instance for every file, so a role set by the previous file would
// leak into the next one's actions.
beforeAll(() => {
  resetAuthState()
  for (const seam of seams) seam.mockReset()
})

// `restoreMocks` restores only before each test, so a spy from a file's last test would still be
// live in the next file's beforeAll.
afterAll(() => vi.restoreAllMocks())
