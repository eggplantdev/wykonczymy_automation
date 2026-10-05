'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { findShare, workerReportShare, type WorkerShareKeyT } from '@/lib/kosztorys/share-token'

// A read, never a mint: a blocked worker's link opens only to be switched off, and a mint there
// would hand out a page that can only show a notice.
export async function readWorkerShareToken(key: WorkerShareKeyT): Promise<string | null> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  const payload = await getPayload({ config })
  return (await findShare(payload, workerReportShare(key)))?.token ?? null
}

// A worker unassigned from every etap who still holds a link must stay listed, so it can be switched off.
export async function readWorkerShareHolders(investmentId: number): Promise<number[]> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  const payload = await getPayload({ config })
  const shares = await payload.find({
    collection: 'worker-report-shares',
    where: { investment: { equals: investmentId } },
    select: { worker: true },
    depth: 0,
    pagination: false,
  })
  return shares.docs.map((share) =>
    typeof share.worker === 'number' ? share.worker : share.worker.id,
  )
}
