import { parseIdParam } from '@/lib/utils/parse-id-param'

/**
 * Anything that isn't an int4 id has to die here. The transfers path interpolates ids into raw SQL
 * (`where-to-sql.ts`), where `?worker=1e999` would land as a bare `infinity` identifier; worker
 * reports bind them against `integer` columns, where an id past int4 is an error rather than a miss.
 */
export function parseNumericIds(param: string | undefined): number[] {
  if (!param) return []
  return param
    .split(',')
    .map(parseIdParam)
    .filter((id) => id !== undefined)
}
