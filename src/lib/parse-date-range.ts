type SearchParamsT = Record<string, string | string[] | undefined>

export type DateRangeT = {
  readonly from: string
  readonly to: string
}

export function parseDateRange(searchParams: SearchParamsT): DateRangeT | undefined {
  const from = typeof searchParams.from === 'string' ? searchParams.from : undefined
  const to = typeof searchParams.to === 'string' ? searchParams.to : undefined
  if (from && to) return { from, to }
  return undefined
}
