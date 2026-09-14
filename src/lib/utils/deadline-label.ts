import { pluralize } from '@/lib/utils/polish-plural'

const days = (count: number) => `${count} ${pluralize(count, ['dzień', 'dni', 'dni'])}`

/**
 * The one Polish phrasing of "how far away is this deadline". Shared by the table cell and the
 * digest mail so a mail can never word the same figure differently from the screen.
 */
export const daysLabel = (daysLeft: number): string => {
  if (daysLeft < 0) return `${days(Math.abs(daysLeft))} po terminie`
  if (daysLeft === 0) return 'dziś'
  return `za ${days(daysLeft)}`
}
