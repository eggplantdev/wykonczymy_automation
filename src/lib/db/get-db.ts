import type { Payload, PayloadRequest } from 'payload'

export type DbExecutorT = {
  execute: (query: unknown) => Promise<{ rows: Record<string, unknown>[] }>
}

export const getDb = async (payload: Payload, req?: PayloadRequest): Promise<DbExecutorT> => {
  const adapter = payload.db as unknown as Record<string, unknown>
  const txId = req?.transactionID ? await req.transactionID : undefined
  const sessions = adapter.sessions as Record<string, { db?: unknown }> | undefined

  if (txId && sessions?.[txId]?.db) return sessions[txId].db as DbExecutorT
  return adapter.drizzle as DbExecutorT
}
