export type UnreadStreamT =
  | 'leads'
  | 'fleet'
  | 'equipment'
  | 'workerReports'
  | 'expenseDrafts'
  | 'rejectedPayouts'

export type UnreadCountsT = Record<UnreadStreamT, number>
