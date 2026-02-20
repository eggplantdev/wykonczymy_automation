'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/permissions'
import { DEFAULT_LIMIT } from '@/lib/pagination'
import type { TransferRowT } from '@/lib/tables/transfers'
import type { PaginationMetaT } from '@/lib/pagination'
import { sumEmployeeSaldo, type DateRangeT } from '@/lib/db/sum-transfers'
import { getCachedEmployeeSaldo, getCachedMonthlyData } from '@/lib/queries/employee-data'

export type MonthlyDataT = {
  rows: TransferRowT[]
  paginationMeta: PaginationMetaT
  monthlySaldo: number
}

export async function getEmployeeSaldo(userId: number, dateRange?: DateRangeT): Promise<number> {
  return getCachedEmployeeSaldo(userId, dateRange)
}

export async function getEmployeeMonthlyData({
  userId,
  month,
  year,
  page = 1,
  limit = DEFAULT_LIMIT,
}: {
  userId: number
  month: number
  year: number
  page?: number
  limit?: number
}): Promise<MonthlyDataT> {
  return getCachedMonthlyData(userId, month, year, page, limit)
}

export async function getManagementEmployeeSaldo(workerId: number): Promise<{ saldo: number }> {
  const user = await getCurrentUserJwt()
  if (!user || !isManagementRole(user.role)) {
    throw new Error('Brak uprawnień')
  }

  // Bypass cache — this is an on-demand fetch from the settlement dialog
  // and must always return fresh data.
  const payload = await getPayload({ config })
  const saldo = await sumEmployeeSaldo(payload, workerId)
  return { saldo }
}
