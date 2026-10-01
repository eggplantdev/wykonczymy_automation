import { NotFound } from 'payload'
import { pl } from '@/lib/i18n/dictionaries/pl'
import type { ActionErrorCodeT } from '@/types/action'

// Payload's own NotFound sentence is the bare word „Nie znaleziono" (its pl `general:notFound`), which
// tells the user neither what is missing nor what to do about it. Re-worded here — and, the part that
// matters, tagged with a code the caller can branch on: a write refused because its row is GONE means
// the caller's whole copy of the data is stale, which is a reseed, not a per-field revert.
//
// A database error's own text is English at best and, once Drizzle wraps it, the whole failed
// statement plus its bind params. `protectedAction` has already logged the original.

type ActionFailureT = { success: false; error: string; code?: ActionErrorCodeT }

// Drizzle's `DrizzleQueryError` carries `query`; the pg / Neon driver error carries `severity` + a
// SQLSTATE `code`. Neither class is importable here (drizzle-orm is not a direct dependency).
function isDatabaseError(err: unknown): boolean {
  for (let current: unknown = err; current instanceof Error; current = current.cause) {
    const fields = current as { query?: unknown; severity?: unknown; code?: unknown }
    if (typeof fields.query === 'string') return true
    if (typeof fields.severity === 'string' && typeof fields.code === 'string') return true
  }
  return false
}

/** Thrown error → the failure branch of `ActionResultT`. */
export function toActionFailure(err: unknown): ActionFailureT {
  if (err instanceof NotFound) {
    return { success: false, error: pl.common.staleRow, code: 'NOT_FOUND' }
  }
  if (isDatabaseError(err)) {
    return { success: false, error: pl.common.databaseError, code: 'DATABASE_ERROR' }
  }
  return { success: false, error: err instanceof Error ? err.message : pl.common.genericError }
}
