import 'server-only'
import type { DeleteForeverResultT } from '@/types/trash'

type PurgeTallyT = {
  purgedIds: number[]
  /** Pinned by a transaction booked after trashing; the write gate should make this 0. */
  blocked: number
  failed: number
}

// One row at a time, so one refusal or failure never strands the rest of the trash.
export async function purgeTrashedRows(
  ids: readonly number[],
  deleteForever: (id: number) => Promise<DeleteForeverResultT>,
  logPrefix: string,
): Promise<PurgeTallyT> {
  const tally: PurgeTallyT = { purgedIds: [], blocked: 0, failed: 0 }

  for (const id of ids) {
    const outcome = await deleteForever(id)
    if (outcome.ok) {
      tally.purgedIds.push(id)
    } else if (outcome.reason === 'blocked') {
      tally.blocked++
      // TODO(EX-449) SENTRY-REQUIRED: a trashed row took a transaction past the write gate.
      console.error(`[${logPrefix}] ${id} blocked: ${outcome.message}`)
    } else if (outcome.reason === 'error') {
      tally.failed++
      // TODO(EX-449) SENTRY-REQUIRED: the row stays in the trash and is retried tomorrow.
      console.error(`[${logPrefix}] ${id} failed: ${outcome.message}`)
    }
  }

  return tally
}
