const UNASSIGNED_KEY = 'unassigned'

export const workerKey = (workerId: number | null) =>
  workerId === null ? UNASSIGNED_KEY : workerId
