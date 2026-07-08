import type { Payload, PayloadRequest } from 'payload'

/** Minimal surface the callers use: run a raw SQL query and read its rows. */
export type DbExecutorT = {
  execute: (query: unknown) => Promise<{ rows: Record<string, unknown>[] }>
}

/**
 * Returns the transaction-scoped Drizzle instance when inside a hook
 * (where `req` carries a `transactionID`), or the default instance otherwise.
 */
export const getDb = async (payload: Payload, req?: PayloadRequest): Promise<DbExecutorT> => {
  const adapter = payload.db as unknown as Record<string, unknown>
  const txId = req?.transactionID ? await req.transactionID : undefined
  const sessions = adapter.sessions as Record<string, { db?: unknown }> | undefined

  if (txId && sessions?.[txId]?.db) return sessions[txId].db as DbExecutorT
  return adapter.drizzle as DbExecutorT
}
