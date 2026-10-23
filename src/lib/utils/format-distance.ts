import { EMPTY_VALUE } from '@/lib/utils/empty-value'

export const formatKm = (value: number) => `${value.toLocaleString('pl-PL')} km`

export const formatKmOrDash = (value: number | null) =>
  value === null ? EMPTY_VALUE : formatKm(value)
