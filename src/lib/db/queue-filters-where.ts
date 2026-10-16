import { sql } from '@payloadcms/db-postgres'
import type { QueueFiltersT } from '@/types/filters'
import { inList, type SqlT } from './sql-list'
import { warsawDayWithin } from './sql-warsaw-day'

export function queueFiltersWhere(
  alias: 'd' | 'r',
  base: SqlT,
  filters: QueueFiltersT<string>,
): SqlT {
  const column = (name: string) => sql.raw(`${alias}.${name}`)
  const conditions = [
    base,
    inList(column('status'), filters.statuses),
    inList(column('investment_id'), filters.investmentIds),
    inList(column('worker_id'), filters.workerIds),
    ...warsawDayWithin(column('sent_at'), filters.sentRange),
  ].filter((condition) => condition !== undefined)
  return sql.join(conditions, sql.raw(' AND '))
}
