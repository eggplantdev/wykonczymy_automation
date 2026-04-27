import type { Where } from 'payload'
import type { FilterConfigT } from '@/types/filters'

export type ExportContextT = 'investment' | 'register'

export type HeaderFieldT = {
  label: string
  value: string
  amount?: number
}

export type FinancialFieldT = HeaderFieldT & { amount: number }

export type TransferQueryT = {
  where: Where
  page: number
  limit: number
}

export type TransferTableConfigT = {
  query: TransferQueryT
  baseUrl: string
  excludeColumns?: string[]
  filters?: FilterConfigT
  context?: ExportContextT
  contextId?: number
  headerFields?: HeaderFieldT[]
  totalPayouts?: number
  totalFilteredAmount?: number
  /** Defaults to true. Set to false to hide the "Suma kwot" button in TransferFilters. */
  showTotalAmount?: boolean
}
