import type { Where } from 'payload'

export type TransferQueryT = {
  readonly where: Where
  readonly page: number
  readonly limit: number
}
