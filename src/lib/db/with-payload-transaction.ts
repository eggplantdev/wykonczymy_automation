import type { Payload, PayloadRequest } from 'payload'
import { UNIQUE_VIOLATION, hasPgCode } from './pg-error'

type TransactionContextT = Record<string, unknown>

type TransactionOptionsT = { isolationLevel?: 'repeatable read' }

/**
 * Read the transaction-scoped DB inside `work` with `getDb(payload, req)` so raw SQL joins the same tx.
 *
 * `options` defaults to the connection's own level (READ COMMITTED), where every statement takes a
 * fresh snapshot — fine for work that reads and writes in one pass, wrong for anything that reads a
 * state and then acts on it.
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
// key — the concurrent write was an INSERT this transaction's snapshot could not see.
const CONCURRENT_WRITE_CODES = ['40001', UNIQUE_VIOLATION]

const MAX_ATTEMPTS = 3

type RetryOptionsT = {
  logLabel: string
  // It must NOT name a concurrent writer — `40001` proves one, `23505` does not, since that is
  // equally what a wipe that half-succeeded leaves behind.
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
        // TODO(EX-958) SENTRY-REQUIRED: the pg code and constraint name are the only thing separating
        // a genuine race from a bug that merely looks like one — the toast can't carry them.
        console.error(`[${logLabel}] concurrent write, attempts exhausted`, error)
        throw new Error(failedMessage)
      }
    }
  }
}
