import type { Where } from 'payload'
import type { FilterConfigT } from '@/types/filters'
import type { PaginationParamsT } from '@/lib/utils/pagination'

// `sort` travels with page/limit, not in the table: EX-777's whole point is the DATABASE orders
// rows, so ordering is part of the query the host parses.
type TransferQueryT = PaginationParamsT & { where: Where; sort: string }

export type TransferTableConfigT = {
  query: TransferQueryT
  /** Heading rendered under the filters, above the table. */
  title?: string
  baseUrl: string
  excludeColumns?: string[]
  filters?: FilterConfigT
  totalFilteredAmount?: number
  /** Server-derived: the list shows cancelled rows but the sum's SQL never counts them. */
  listsCancelled?: boolean
  /** Defaults to true. Set to false to hide the "Suma kwot" button in TransferFilters. */
  showTotalAmount?: boolean
  cancelledTransactionAudit?: boolean
  /**
   * Opt in to the invoice-download button. The fetch behind it is unpaginated over the table's own
   * `where`, so on an unanchored filter (`/raporty` with nothing applied) it ZIPs every invoice in
   * the system — deliberate there, but weigh it before opting a new page in.
   */
  invoiceDownload?: boolean
  /**
   * Opt in to the print button. Its own flag, never `invoiceDownload`'s — one feature's data must
   * not gate another's visibility. Same unpaginated-fetch caveat as invoiceDownload. Optional and
   * SILENT: a page that forgets to set it compiles clean with no button, so verify each host.
   */
  print?: boolean
}
