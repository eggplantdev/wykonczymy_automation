import { NotFound } from 'payload'
import { pl } from '@/lib/i18n/dictionaries/pl'
import type { ActionErrorCodeT } from '@/types/action'

// A database error's own text is English at best and, once Drizzle wraps it, the whole failed
// statement plus its bind params.

type ActionFailureT = { success: false; error: string; code?: ActionErrorCodeT }

// Neither class is importable here (drizzle-orm is not a direct dependency).
function isDatabaseError(err: unknown): boolean {
  for (let current: unknown = err; current instanceof Error; current = current.cause) {
    const fields = current as { query?: unknown; severity?: unknown; code?: unknown }
    if (typeof fields.query === 'string') return true
    if (typeof fields.severity === 'string' && typeof fields.code === 'string') return true
  }
  return false
}

export function toActionFailure(err: unknown): ActionFailureT {
  if (err instanceof NotFound) {
    return { success: false, error: pl.common.staleRow, code: 'NOT_FOUND' }
  }
  if (isDatabaseError(err)) {
    return { success: false, error: pl.common.databaseError, code: 'DATABASE_ERROR' }
  }
  return { success: false, error: err instanceof Error ? err.message : pl.common.genericError }
}
