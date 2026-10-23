import { formatPLDate } from '@/lib/utils/format-date'
import { EMPTY_VALUE } from '@/lib/utils/empty-value'

export function dateCell(info: { getValue: () => string | Date | null | undefined }) {
  const value = info.getValue()
  return value ? formatPLDate(value) : EMPTY_VALUE
}
