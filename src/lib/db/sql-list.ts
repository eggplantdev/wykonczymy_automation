import { sql } from '@payloadcms/db-vercel-postgres'

/** `a, b, c` as bound parameters, for an `IN (…)` list. A bound array does not work here: the
 *  driver flattens it into one parameter per element, which `= ANY($n)` reads as a malformed literal. */
export const sqlList = (values: readonly (string | number)[]) =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql.raw(', '),
  )
