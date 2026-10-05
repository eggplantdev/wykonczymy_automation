import { sql } from '@payloadcms/db-vercel-postgres'
import type { DateRangeT } from '@/lib/utils/date-range'
import type { SqlT } from './sql-list'

/**
 * The Warsaw calendar day, so a row sent at 00:30 belongs to that day rather than UTC's. Kept as
 * `YYYY-MM-DD` text and compared lexically, like `isWithinRange`, so no bound can fail a `::date` cast.
 */
export function warsawDayWithin(timestamp: SqlT, { from, to }: DateRangeT): SqlT[] {
  const day = sql`to_char(${timestamp} AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD')`
  return [
    ...(from === undefined ? [] : [sql`${day} >= ${from}`]),
    ...(to === undefined ? [] : [sql`${day} <= ${to}`]),
  ]
}
