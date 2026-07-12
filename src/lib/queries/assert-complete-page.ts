import 'server-only'
import type { PaginatedDocs } from 'payload'

// Payload's `find` is paginated: when more rows match than `limit`, it SILENTLY returns the first
// page and sets hasNextPage. That's correct for a UI pager, but a read that must be COMPLETE — a
// backup/serialize, a financial aggregate, anything that flattens `.docs` as "all of them" — is
// silently wrong past the cap, and a wipe-and-reinsert restore then makes that truncation permanent.
// This converts the silent truncation into a loud throw at the call site. Using it is the caller
// asserting "I need every row, not a page"; a paginated UI read that genuinely wants a page skips it.
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
