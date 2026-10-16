import { pluralize } from '@/lib/utils/polish-plural'

const days = (count: number) => `${count} ${pluralize(count, ['dzień', 'dni', 'dni'])}`

export const daysLabel = (daysLeft: number): string => {
  if (daysLeft < 0) return `${days(Math.abs(daysLeft))} po terminie`
  if (daysLeft === 0) return 'dziś'
  return `za ${days(daysLeft)}`
}
