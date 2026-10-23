import { vi } from 'vitest'
import { resetAuthState } from '@/__tests__/stubs/get-current-user-jwt'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const { passThrough, resetSeams } = await vi.hoisted(() => import('@/__tests__/setup/seams'))

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
vi.mock('@/lib/google/transfer-sheet-sync', (importOriginal) =>
  passThrough(importOriginal, 'syncBulkExpensesToSheet'),
)
vi.mock('@/lib/push/notify-pending-receipts', (importOriginal) =>
  passThrough(importOriginal, 'notifyPendingReceipts'),
)
vi.mock('@/lib/push/notify-ai-stage', (importOriginal) =>
  passThrough(importOriginal, 'notifyAiStageChange'),
)

// `db-shared` keeps one module instance for every file, so a role set by the previous file would
// leak into the next one's actions.
resetAuthState()
resetSeams()
