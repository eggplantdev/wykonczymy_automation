const MAX_INT4 = 2_147_483_647

// An id search param is typed by hand as often as clicked. Anything that isn't an id a Postgres
// `integer` can hold reads as absent, not as a query error.
export function parseIdParam(value: string | string[] | undefined): number | undefined {
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value)) return undefined
  const id = Number(value)
  return id > 0 && id <= MAX_INT4 ? id : undefined
}
