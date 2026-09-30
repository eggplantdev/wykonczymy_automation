export type UnreadStreamT = 'leads' | 'fleet' | 'equipment' | 'workReports'

export type UnreadCountsT = Record<UnreadStreamT, number>
