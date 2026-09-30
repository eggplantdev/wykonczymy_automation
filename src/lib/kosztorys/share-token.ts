import 'server-only'
import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'
import type { WorkerLinkKindT } from '@/lib/kosztorys/worker-view/types'
import type { ActionResultT } from '@/types/action'

// 24 bytes ≈ 192 bits of entropy — the token IS the credential for an unauthenticated page, so it
// has to be unguessable at the scale of the whole internet, not just of this company's users.
const TOKEN_BYTES = 24

export type ShareRowT =
  | { collection: 'kosztorys-shares'; owner: { investment: number } }
  | { collection: 'kosztorys-worker-shares'; owner: { investment: number; worker: number } }
  | { collection: 'worker-report-shares'; owner: { investment: number; worker: number } }

export type WorkerShareKeyT = { investmentId: number; workerId: number }

export const investorShare = (investmentId: number): ShareRowT => ({
  collection: 'kosztorys-shares',
  owner: { investment: investmentId },
})

export const workerShare = ({ investmentId, workerId }: WorkerShareKeyT): ShareRowT => ({
  collection: 'kosztorys-worker-shares',
  owner: { investment: investmentId, worker: workerId },
})

export const workerReportShare = ({ investmentId, workerId }: WorkerShareKeyT): ShareRowT => ({
  collection: 'worker-report-shares',
  owner: { investment: investmentId, worker: workerId },
})

export const WORKER_LINK_SHARES: Record<WorkerLinkKindT, (key: WorkerShareKeyT) => ShareRowT> = {
  rozpiska: workerShare,
  report: workerReportShare,
}

export async function findShare(payload: Payload, row: ShareRowT) {
  const where = Object.fromEntries(
    Object.entries(row.owner).map(([field, id]) => [field, { equals: id }]),
  )
  const shares = await payload.find({ collection: row.collection, where, depth: 0, limit: 1 })
  return shares.docs[0] ?? null
}

/**
 * `rotate` overwrites a live token, which is what makes „wygeneruj nowy" an actual revocation of the
 * previous URL rather than a second live door. Without it a live token is handed back untouched, so
 * two overlapping „Udostępnij" clicks cannot kill the link the first one copied.
 */
export async function writeShareToken(
  payload: Payload,
  row: ShareRowT,
  { rotate }: { rotate: boolean },
): Promise<ActionResultT<string>> {
  const share = await findShare(payload, row)
  if (share && !rotate) return { success: true, data: share.token }
  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  if (share) {
    await payload.update({ collection: row.collection, id: share.id, data: { token } })
    return { success: true, data: token }
  }
  try {
    await payload.create({ collection: row.collection, data: { ...row.owner, token } })
  } catch {
    // find-then-create is not atomic and the owner is unique — two clicks at once race here. The
    // loser re-reads: by then a link demonstrably exists, which is all the caller wanted.
    const winner = await findShare(payload, row)
    return winner
      ? { success: true, data: winner.token }
      : { success: false, error: 'Nie udało się wygenerować linku' }
  }
  return { success: true, data: token }
}

// No row, no public read — the token stops resolving on the next request.
export async function deleteShare(payload: Payload, row: ShareRowT) {
  const share = await findShare(payload, row)
  if (share) await payload.delete({ collection: row.collection, id: share.id })
}
