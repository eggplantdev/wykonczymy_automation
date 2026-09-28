export type AcceptanceKindT = 'partial' | 'final' | 'reinspection'

// Dates are `YYYY-MM-DD` as the date picker produces them; '' means left blank for the pen.
export type AcceptanceProtocolFormT = {
  kind: AcceptanceKindT
  place: string
  issueDate: string
  acceptanceDate: string
  readinessDate: string
  clientName: string
  siteAddress: string
  paymentDueDate: string
}

export type ProtocolScopeRowT = {
  sectionName: string
  description: string
  qty: number
  unit: string
}

export type ProtocolSettlementT = {
  laborCostsNet: number
  materialsNet: number
  totalNet: number
  paidNet: number
  lossNet: number
  remainingNet: number
  isOverpaid: boolean
}

export type SettlementLineT = {
  label: string
  amount: number
  emphasis?: 'subtotal' | 'total'
}
