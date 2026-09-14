import type { CollectionSlug, Payload } from 'payload'

export type SequentialUpdateT = { id: number; data: Record<string, unknown> }

/**
 * Apply bookkeeping updates one at a time, reporting the ids that failed.
 *
 * Never in parallel: the deployed database keeps one of a set of concurrent Payload writes, drops
 * the rest and reports success for all of them — so a parallel sweep would report every row stamped
 * while only one of them was, and re-announce the others daily until someone noticed. Same failure
 * that lost the pages of a deleted multi-page invoice; see `lib/invoices/delete-unreferenced-media.ts`.
 *
 * Returns the failed ids instead of throwing: the callers stamp AFTER a mail is already out, so a
 * rejection here would make the run report a total failure and earn a cron retry that re-sends the
 * whole digest. An unstamped row simply re-announces tomorrow, which is the harmless direction.
 */
export async function stampSequentially(
  payload: Payload,
  collection: CollectionSlug,
  updates: readonly SequentialUpdateT[],
  context?: Record<string, unknown>,
): Promise<number[]> {
  const failed: number[] = []

  for (const update of updates) {
    try {
      await payload.update({
        collection,
        id: update.id,
        overrideAccess: true,
        data: update.data,
        ...(context && { context }),
      })
    } catch {
      failed.push(update.id)
    }
  }

  return failed
}
