const MAX_INT4 = 2_147_483_647

export function parseIdParam(value: string | string[] | undefined): number | undefined {
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value)) return undefined
  const id = Number(value)
  return id > 0 && id <= MAX_INT4 ? id : undefined
}
