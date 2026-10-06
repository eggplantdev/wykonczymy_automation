'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'

// A worker unassigned from every etap still holds his link, so he stays listed and it can be rotated.
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
