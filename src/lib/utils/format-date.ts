/** Formats a date string as dd.mm.yyyy (Polish locale). */
export const formatPLDate = (date: string | Date) =>
  new Date(date).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

/** Formats a date string as dd.mm.yyyy, hh:mm (Polish locale). */
export const formatPLDateTime = (date: string | Date) =>
  new Date(date).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
