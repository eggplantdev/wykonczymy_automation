import type { Where } from 'payload'
import type { FilterConfigT } from '@/types/filters'
import type { PaginationParamsT } from '@/lib/utils/pagination'
import type { ActionResultT } from '@/types/action'
import type { TransferRowT } from '@/types/transfers'
import type { FetchFilteredTransfersOptsT } from '@/lib/queries/fetch-transfers-for-invoices'

type TransferQueryT = PaginationParamsT & { where: Where; sort: string }

export type TransferTableConfigT = {
  query: TransferQueryT
  title?: string
  baseUrl: string
  excludeColumns?: string[]
  filters?: FilterConfigT
  totalFilteredAmount?: number
  /** Server-derived: the list shows cancelled rows but the sum's SQL never counts them. */
  listsCancelled?: boolean
  showTotalAmount?: boolean
  cancelledTransactionAudit?: boolean
  onlyWorkerDrafts?: boolean
  /** The fetch behind it is unpaginated over the table's own `where`, so on a page not anchored
   * to one entity it ZIPs every invoice the filters let through */
  invoiceDownload?: boolean
  print?: boolean
  duplicateFinder?: boolean
  uncoloredAmounts?: boolean
}

export type TransferRowsFetchT = (
  opts?: FetchFilteredTransfersOptsT,
) => Promise<ActionResultT<TransferRowT[]>>
