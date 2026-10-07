export type UnreadStreamT = 'leads' | 'fleet' | 'equipment' | 'workerReports' | 'expenseDrafts'

export type UnreadCountsT = Record<UnreadStreamT, number>
