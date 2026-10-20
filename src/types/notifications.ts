export type UnreadStreamT =
  | 'leads'
  | 'fleet'
  | 'equipment'
  | 'workerReports'
  | 'expenseDrafts'
  | 'rejectedReceipts'

export type UnreadCountsT = Record<UnreadStreamT, number>
