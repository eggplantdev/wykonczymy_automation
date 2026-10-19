import type { CashRegisterTypeT } from '@/types/reference-data'

export const REGISTER_TYPE_LABELS: Record<CashRegisterTypeT, string> = {
  MAIN: 'Główne',
  AUXILIARY: 'Pomocnicze',
  VIRTUAL: 'Wirtualne',
  WORKER: 'Pracownicze',
}

export const REGISTER_TYPES = Object.keys(REGISTER_TYPE_LABELS) as CashRegisterTypeT[]

export const REGISTER_TYPE_BORDER_COLORS: Record<CashRegisterTypeT, string> = {
  MAIN: 'border-chart-blue',
  AUXILIARY: 'border-chart-teal',
  VIRTUAL: 'border-chart-purple',
  WORKER: 'border-chart-orange',
}
