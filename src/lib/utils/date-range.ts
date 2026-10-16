export type DateRangeT = {
  from?: string
  to?: string
}

export type ClosedDateRangeT = Required<DateRangeT>

export const ALL_TIME: DateRangeT = {}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * the comparison downstream is lexical, so junk never errors, it silently matches nothing and every
 * total reads zero
 */
export const dayBound = (value: unknown): string | undefined =>
  typeof value === 'string' && ISO_DAY.test(value) && isCalendarDay(value) ? value : undefined

const isCalendarDay = (day: string): boolean => {
  const parsed = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(day)
}

export const urlDateRange = (params: Pick<URLSearchParams, 'get'>): DateRangeT => ({
  from: dayBound(params.get('from')),
  to: dayBound(params.get('to')),
})

export const isClosedRange = (range: DateRangeT): range is ClosedDateRangeT => {
  const from = dayBound(range.from)
  const to = dayBound(range.to)
  return Boolean(from && to && from <= to)
}

export const isAllTime = (range: DateRangeT): boolean =>
  range.from === undefined && range.to === undefined

export const isWithinRange = (day: string, { from, to }: DateRangeT): boolean =>
  (from === undefined || day >= from) && (to === undefined || day <= to)
