'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { findShare, WORKER_LINK_SHARES, type WorkerShareKeyT } from '@/lib/kosztorys/share-token'
import type { WorkerLinkKindT } from '@/lib/kosztorys/worker-view/types'

// A read, never a mint: a blocked worker's link opens only to be switched off, and a mint there
// would hand out a page that can only show a notice.
export async function readWorkerShareToken(
  key: WorkerShareKeyT,
  kind: WorkerLinkKindT = 'rozpiska',
): Promise<string | null> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  const payload = await getPayload({ config })
  return (await findShare(payload, WORKER_LINK_SHARES[kind](key)))?.token ?? null
}

// Per kind: a worker unassigned from every etap who still holds only a report link must stay listed,
// and only the kind he holds may be switched off.
export async function readWorkerShareHolders(
  investmentId: number,
): Promise<Record<WorkerLinkKindT, number[]>> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  const payload = await getPayload({ config })
  const query = { where: { investment: { equals: investmentId } }, depth: 0, pagination: false }
  const [rozpiska, report] = await Promise.all([
    payload.find({ collection: 'kosztorys-worker-shares', ...query, select: { worker: true } }),
    payload.find({ collection: 'worker-report-shares', ...query, select: { worker: true } }),
  ])
  const workerIds = (docs: { worker: number | { id: number } }[]) =>
    docs.map((share) => (typeof share.worker === 'number' ? share.worker : share.worker.id))
  return { rozpiska: workerIds(rozpiska.docs), report: workerIds(report.docs) }
}
