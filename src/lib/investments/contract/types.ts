import type { AddressT } from '@/lib/investments/format-address'

// Dates are `YYYY-MM-DD` as the date picker produces them; '' means left blank for the pen.
export type ContractFormT = {
  number: string
  signDate: string
  place: string
  clientName: string
  clientPesel: string
  clientAddress: AddressT
  siteAddress: AddressT
  startWindow: string
  duration: string
  supervisors: string
  plannedNet: string
  isCompany: boolean
}

export type ContractClauseFieldT =
  | 'siteAddress'
  | 'startWindow'
  | 'duration'
  | 'supervisors'
  | 'plannedNet'

// Point text may carry `{field}` tokens, filled from the form as dotted fields.
export type ContractPointT = {
  text: string
  subpoints?: string[]
}

export type ContractSectionT = {
  title: string
  points: ContractPointT[]
}
