import { vi } from 'vitest'
import type { Payload } from 'payload'

/**
 * `getDb` resolves to `payload.db.drizzle` when there is no req/transactionID, so a fake with just
 * `execute` satisfies every raw-SQL query in `lib/db`.
 */
export const mockExecute = vi.fn()

export const fakePayload = {
  db: { drizzle: { execute: mockExecute }, sessions: {} },
} as unknown as Payload

export function lastSql(): string {
  const calls = mockExecute.mock.calls
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = calls[calls.length - 1][0] as any
  return query.queryChunks?.[0]?.value?.[0] ?? String(query)
}

export function resetFakePayload(): void {
  mockExecute.mockReset()
  mockExecute.mockResolvedValue({ rows: [] })
}
