/** Returns today's date as YYYY-MM-DD string. */
export const today = () => new Date().toISOString().split('T')[0]

/**
 * Returns the first and last day of the given month as ISO date strings.
 */
export function getMonthDateRange(month: number, year: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}
