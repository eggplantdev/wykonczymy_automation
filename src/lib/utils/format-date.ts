// Pinned to the company's clock, deliberately. Without a timeZone the runtime's own zone decides:
// a Vercel server renders 22:30 into the HTML and the browser rehydrates the same row to 00:30, which
// is React #418 on every table carrying a timestamp — and on a bare 'YYYY-MM-DD' (read as UTC
// midnight) anything west of Greenwich renders the day before. The reader's location is not part of
// what these dates mean: they are a Polish company's dates wherever they are read.
const PL_TIME_ZONE = 'Europe/Warsaw'

/** Formats a date string as dd.mm.yyyy (Polish locale). */
export const formatPLDate = (date: string | Date) =>
  new Date(date).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: PL_TIME_ZONE,
  })

/** Formats a date string as dd.mm.yyyy, hh:mm (Polish locale). */
// `locale` changes only the wording; the clock stays Polish, where the work was done.
export const formatPLDateTime = (date: string | Date, locale = 'pl-PL') =>
  new Date(date).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PL_TIME_ZONE,
  })
