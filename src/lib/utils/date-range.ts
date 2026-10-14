/**
 * A filter window over calendar days (`YYYY-MM-DD`), open at either end.
 *
 * Both bounds are optional because one bound is a legitimate filter on its own — „everything since
 * July" is a question users ask — and requiring the pair turns that into no filter at all.
 */
export type DateRangeT = {
  from?: string
  to?: string
}

export type ClosedDateRangeT = Required<DateRangeT>

/** No window. Spelled out so a caller has to say which it wants rather than omit an argument. */
export const ALL_TIME: DateRangeT = {}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * One bound as it arrives from outside — a URL param, which anybody can type into. Anything that is
 * not an ISO day is dropped rather than passed through: the comparison downstream is lexical, so junk
 * never errors, it silently matches nothing and every total reads zero — indistinguishable from an
 * honest empty window. The picker is less forgiving still, rendering „NaN" into Rok/Miesiąc off the
 * `new Date(bound + 'T00:00:00')` it anchors on — and rolls `2026-02-30` into March without a word,
 * hence the round-trip. A repeated param arrives as an array and is dropped for the same reason:
 * `?from=a&from=b` has no sensible single answer.
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

/** Both ends valid days and in order — a junk or inverted window would read as an honest empty one. */
export const isClosedRange = (range: DateRangeT): range is ClosedDateRangeT => {
  const from = dayBound(range.from)
  const to = dayBound(range.to)
  return Boolean(from && to && from <= to)
}

export const isAllTime = (range: DateRangeT): boolean =>
  range.from === undefined && range.to === undefined

/** Lexical on purpose: `YYYY-MM-DD` sorts chronologically, so no date parsing is involved. */
export const isWithinRange = (day: string, { from, to }: DateRangeT): boolean =>
  (from === undefined || day >= from) && (to === undefined || day <= to)
