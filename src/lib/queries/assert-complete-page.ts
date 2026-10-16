import 'server-only'
import type { PaginatedDocs } from 'payload'

export function assertCompletePage<T>(result: PaginatedDocs<T>, context: string): T[] {
  if (result.hasNextPage) {
    throw new Error(
      `[assertCompletePage] ${context}: matched ${result.totalDocs} rows but the query capped at ` +
        `limit ${result.limit} — the result is truncated. Raise the limit or paginate; ` +
        `refusing to return a partial set.`,
    )
  }
  return result.docs
}
