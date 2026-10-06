import { sql } from '@payloadcms/db-vercel-postgres'

export type SqlT = ReturnType<typeof sql>

/** `a, b, c` as bound parameters, for an `IN (…)` list. A bound array does not work here: the
 *  driver flattens it into one parameter per element, which `= ANY($n)` reads as a malformed literal. */
export const sqlList = (values: readonly (string | number)[]) =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql.raw(', '),
  )

/** `null` leaves the column unfiltered; an empty list matches nothing (the URL named no valid value). */
export const inList = (
  column: SqlT,
  values: readonly (string | number)[] | null,
): SqlT | undefined => {
  if (values === null) return undefined
  return values.length > 0 ? sql`${column} IN (${sqlList(values)})` : sql`false`
}
