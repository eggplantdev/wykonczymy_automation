// Without a timeZone the runtime's own zone decides: a Vercel server renders 22:30 into the HTML and
// the browser rehydrates the same row to 00:30, which is React #418 on every table carrying a timestamp
const PL_TIME_ZONE = 'Europe/Warsaw'

export const formatPLDate = (date: string | Date) =>
  new Date(date).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: PL_TIME_ZONE,
  })

export const formatPLDateTime = (date: string | Date, locale = 'pl-PL') =>
  new Date(date).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PL_TIME_ZONE,
  })
