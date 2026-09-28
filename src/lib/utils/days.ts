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

const WARSAW_OFFSET = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Warsaw',
  timeZoneName: 'longOffset',
})

// Warsaw's DST switches at 01:00 UTC, so UTC midnight of `day` always carries the same offset as
// Warsaw midnight of `day` (22:00/23:00 UTC the evening before) — neither straddles a switch.
function warsawMidnight(day: DayT): Date {
  const offset = WARSAW_OFFSET.formatToParts(new Date(`${day}T00:00:00Z`)).find(
    (part) => part.type === 'timeZoneName',
  )?.value
  return new Date(`${day}T00:00:00${offset?.replace('GMT', '') || 'Z'}`)
}

/** The last instant of the Warsaw day before the one `now` falls on. */
export const endOfPreviousWarsawDay = (now: Date): Date =>
  new Date(warsawMidnight(warsawToday(now)).getTime() - 1)

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
