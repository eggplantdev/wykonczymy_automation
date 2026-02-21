import type { WorkerPeriodBreakdownT } from '@/lib/db/sum-transfers'

export type UserDetailT = {
  name: string
  email: string
  role: string
  saldo: number
  periodBreakdown?: WorkerPeriodBreakdownT
}
