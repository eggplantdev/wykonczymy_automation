import { findTransfersRaw } from '@/lib/queries/transfers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { buildTransferRows } from '@/lib/queries/fetch-transfer-rows'
import { TransferDataTable } from '@/components/transfers/transfer-data-table'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { perfStart } from '@/lib/perf'
import type { TransferTableConfigT } from '@/types/export'

type TransferTableServerPropsT = {
  config: TransferTableConfigT
}

export async function TransferTableServer({ config }: TransferTableServerPropsT) {
  const step = perfStart()
  const skipMedia = config.excludeColumns?.includes('invoice') ?? false

  const [rawTxResult, refData, { user }] = await Promise.all([
    findTransfersRaw(config.query),
    fetchReferenceData(),
    requireAuth(MANAGEMENT_ROLES),
  ])
  console.log(`[PERF] TransferTableServer findTransfersRaw + fetchReferenceData ${step()}ms`)

  const rows = await buildTransferRows(rawTxResult.docs, refData, { skipMedia })
  console.log(`[PERF] TransferTableServer buildTransferRows ${step()}ms`)

  return (
    <TransferDataTable
      data={rows}
      paginationMeta={rawTxResult.paginationMeta}
      config={config}
      referenceData={refData}
      currentUserId={user?.id}
      currentUserRole={user?.role}
    />
  )
}
