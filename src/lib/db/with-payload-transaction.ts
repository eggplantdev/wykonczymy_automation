import type { Payload, PayloadRequest } from 'payload'
import { UNIQUE_VIOLATION, hasPgCode } from './pg-error'

type TransactionContextT = Record<string, unknown>

// Payload hands `beginTransaction`'s options straight to drizzle's `transaction(fn, config)`, so this
// is where a caller reaches Postgres's isolation level. Narrowed to the one level anybody here asks
// for rather than re-exporting drizzle's whole config surface.
type TransactionOptionsT = { isolationLevel?: 'repeatable read' }

/**
 * Runs `work` inside a single Payload transaction: begins it, builds the transaction-scoped `req`,
 * commits on success and returns `work`'s value, or rolls back and rethrows on any error.
 *
 * `context` rides on `req.context`, which Payload forwards to afterChange hooks — each caller states
 * its own policy (`skipRevalidation` for the kosztorys writes, `skipSheetSync` for the batched transfer
 * create); this generic primitive holds no default so no caller silently inherits another's. Read the
 * transaction-scoped DB inside `work` with `getDb(payload, req)` so raw SQL joins the same tx.
 *
 * `options` defaults to the connection's own level (READ COMMITTED), where every statement takes a
 * fresh snapshot — fine for work that reads and writes in one pass, wrong for anything that reads a
 * state and then acts on it (see `replaceTreeWithSnapshot`).
 */
export async function withPayloadTransaction<T>(
  payload: Payload,
  work: (req: PayloadRequest) => Promise<T>,
  context: TransactionContextT,
  options?: TransactionOptionsT,
): Promise<T> {
  const transactionId = await payload.db.beginTransaction(options)
  if (!transactionId) throw new Error('Nie udało się rozpocząć transakcji.')
  const req = { transactionID: transactionId, context } as unknown as PayloadRequest
  try {
    const result = await work(req)
    await payload.db.commitTransaction(transactionId)
    return result
  } catch (error) {
    await payload.db.rollbackTransaction(transactionId)
    throw error
  }
}

// The two shapes a lost race takes under `repeatable read`: 40001 when a write meets a row someone
// updated after this transaction's snapshot, and 23505 when the same collision arrives as a duplicate
// key — the concurrent write was an INSERT this transaction's snapshot could not see, so a re-INSERT
// lands on it. Retrying is only ever sound for a caller that re-reads its input on the next attempt.
const CONCURRENT_WRITE_CODES = ['40001', UNIQUE_VIOLATION]

// A conflict means this attempt read a state that is no longer current, so retrying is not hopeful
// repetition — the next attempt opens a fresh snapshot and sees the writer that beat it. Bounded
// because a genuinely hot row must eventually tell the owner rather than spin: two retries cover the
// realistic pile-up (a second tab, a double-click) and anything past that is worth surfacing.
const MAX_ATTEMPTS = 3

type RetryOptionsT = {
  logLabel: string
  // Says only what the pg code actually proves: nothing was written, and retrying is safe. It must
  // NOT name a concurrent writer — `40001` proves one, `23505` does not, since that is equally what a
  // wipe that half-succeeded leaves behind (restore-kosztorys.ts). Postgres's own text is no better:
  // an English dump of the failed statement and its bind params, which `protectedAction` would put
  // straight into the toast.
  failedMessage: string
}

// For a `repeatable read` transaction that re-reads its input on every attempt — retrying anything
// else would just replay a stale decision.
export async function retryOnConcurrentWrite<T>(
  attempt: () => Promise<T>,
  { logLabel, failedMessage }: RetryOptionsT,
): Promise<T> {
  for (let n = 1; ; n += 1) {
    try {
      return await attempt()
    } catch (error) {
      if (!hasPgCode(error, CONCURRENT_WRITE_CODES)) throw error
      if (n >= MAX_ATTEMPTS) {
        // TODO(EX-449) SENTRY-REQUIRED: the pg code and constraint name are the only thing separating
        // a genuine race from a bug that merely looks like one — the toast can't carry them.
        console.error(`[${logLabel}] concurrent write, attempts exhausted`, error)
        throw new Error(failedMessage)
      }
    }
  }
}
