import { sql } from '@payloadcms/db-postgres'
import type { DateRangeT } from '@/lib/utils/date-range'
import type { SqlT } from './sql-list'

/** Kept as `YYYY-MM-DD` text and compared lexically so no bound can fail a `::date` cast. */
export function warsawDayWithin(timestamp: SqlT, { from, to }: DateRangeT): SqlT[] {
  const day = sql`to_char(${timestamp} AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD')`
  return [
    ...(from === undefined ? [] : [sql`${day} >= ${from}`]),
    ...(to === undefined ? [] : [sql`${day} <= ${to}`]),
  ]
}
