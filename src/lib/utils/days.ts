const WARSAW_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** A calendar day as `YYYY-MM-DD`. Deadlines are days, not instants. */
export type DayT = string

/**
 * The Warsaw calendar day a stored timestamp falls on.
 *
 * Day-only fields are persisted as midnight UTC (this DB's existing convention — see the fleet
 * migration), so reading them back in Warsaw lands on 01:00/02:00 of the same day. Going through the
 * timezone anyway is what keeps a real timestamp (`notifiedAt`) honest on the same code path.
 */
export const toWarsawDay = (value: Date | string): DayT =>
  WARSAW_DAY.format(typeof value === 'string' ? new Date(value) : value)

/** Today in Warsaw. Resolve ONCE per run and thread it through — never re-read inside a loop. */
export const warsawToday = (now: Date = new Date()): DayT => toWarsawDay(now)

/**
 * Whole days from `from` to `to`, negative when `to` is earlier. Both are parsed as UTC midnight, so
 * a DST switch can never make a day count 23 or 25 hours long.
 */
export const daysBetween = (from: DayT, to: DayT): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

export const addMonthsToDay = (day: DayT, months: number): DayT => {
  const [year, month, date] = day.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + months, date))
  // A shorter target month (31 Jan + 1 month) overflows into the next one; clamp to its last day.
  if (shifted.getUTCDate() !== date) shifted.setUTCDate(0)
  return shifted.toISOString().slice(0, 10)
}
