/** Absent or empty → `null`, leaving the column unfiltered; a junk value parses to `[]`, matching
 *  nothing. */
export function listParam<T>(value: unknown, parse: (param: string) => T[]): T[] | null {
  return typeof value === 'string' && value !== '' ? parse(value) : null
}
