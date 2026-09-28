const MAX_INT4 = 2_147_483_647

// `?wersja=` is typed by hand as often as clicked. Anything that isn't an id a Postgres `integer` can
// hold is the present, not a query error.
export function parseVersionParam(value: string | string[] | undefined): number | undefined {
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value)) return undefined
  const id = Number(value)
  return id > 0 && id <= MAX_INT4 ? id : undefined
}
