import type { Where } from 'payload'
import type { FilterConfigT } from '@/types/filters'

export type ExportContextT = 'investment' | 'register'

export type HeaderFieldT = {
  readonly label: string
  readonly value: string
  readonly amount?: number
}

export type TransferQueryT = {
  readonly where: Where
  readonly page: number
  readonly limit: number
}

export type TransferTableConfigT = {
  readonly query: TransferQueryT
  readonly baseUrl: string
  readonly excludeColumns?: string[]
  readonly filters?: FilterConfigT
  readonly context?: ExportContextT
  readonly contextId?: number
  readonly headerFields?: HeaderFieldT[]
}
