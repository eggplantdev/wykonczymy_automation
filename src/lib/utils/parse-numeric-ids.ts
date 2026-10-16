import { parseIdParam } from '@/lib/utils/parse-id-param'

// The transfers path interpolates ids into raw SQL (`where-to-sql.ts`), where `?worker=1e999` would
// land as a bare `infinity` identifier
export function parseNumericIds(param: string | undefined): number[] {
  if (!param) return []
  return param
    .split(',')
    .map(parseIdParam)
    .filter((id) => id !== undefined)
}
