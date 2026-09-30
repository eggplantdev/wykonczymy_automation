export type UnreadStreamT = 'leads' | 'fleet' | 'equipment' | 'workerReports'

export type UnreadCountsT = Record<UnreadStreamT, number>
