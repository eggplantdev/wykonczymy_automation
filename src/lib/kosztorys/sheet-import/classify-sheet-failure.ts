import { MissingLaborTabError } from './read-sheet'

export type SheetFailureReasonT = 'forbidden' | 'not-found' | 'missing-tab' | 'unknown'

export type SheetFailureT = {
  reason: SheetFailureReasonT
  // Filled only for `forbidden`.
  serviceAccountEmail: string | null
}

const PERMISSION_DENIED = 'PERMISSION_DENIED'

// Reading only one of them silently degrades every 403 into the catch-all.
function errorCodes(error: unknown): (number | string)[] {
  if (typeof error !== 'object' || error === null) return []
  const candidate = error as { status?: unknown; code?: unknown; response?: { status?: unknown } }
  return [candidate.status, candidate.code, candidate.response?.status].flatMap((value) => {
    if (typeof value === 'number') return [value]
    if (typeof value !== 'string') return []
    return [/^\d+$/.test(value) ? Number(value) : value]
  })
}

export function classifySheetFailure(error: unknown): SheetFailureReasonT {
  if (error instanceof MissingLaborTabError) return 'missing-tab'
  const codes = errorCodes(error)
  if (codes.includes(403) || codes.includes(PERMISSION_DENIED)) return 'forbidden'
  if (codes.includes(404)) return 'not-found'
  return 'unknown'
}
