import type { CollectionSlug, Payload } from 'payload'

export type SequentialUpdateT = { id: number; data: Record<string, unknown> }

/**
 * Never in parallel: the deployed database keeps one of a set of concurrent Payload writes, drops
 * the rest and reports success for all of them.
 *
 * Returns the failed ids instead of throwing: the callers stamp AFTER a mail is already out, so a
 * rejection here would make the run report a total failure and earn a cron retry that re-sends the
 * whole digest.
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
