import { VAT_PLANES, VAT_PLANE_LABELS, type VatPlaneT } from '@/lib/constants/transfers'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'

// Type-only imports from money-axis on purpose: this module is reached from the Payload collection
// config, and a value import would drag the grid's column-config into `payload generate:types`.
export const SETTLEMENT_MODES = [...VAT_PLANES, 'MIXED'] as const

export type SettlementModeT = VatPlaneT | 'MIXED'

export const SETTLEMENT_MODE_DEFAULT: SettlementModeT = 'NET'

const SETTLEMENT_MODE_LABELS: Record<SettlementModeT, { en: string; pl: string }> = {
  NET: { en: 'Net', pl: VAT_PLANE_LABELS.NET },
  GROSS: { en: 'Gross', pl: VAT_PLANE_LABELS.GROSS },
  MIXED: { en: 'Mixed', pl: 'Mieszane' },
}

export function settlementModeLabel(mode: SettlementModeT): string {
  return SETTLEMENT_MODE_LABELS[mode].pl
}

export const SETTLEMENT_MODE_OPTIONS = SETTLEMENT_MODES.map((value) => ({
  value,
  label: SETTLEMENT_MODE_LABELS[value].pl,
}))

export const SETTLEMENT_MODE_ADMIN_OPTIONS = SETTLEMENT_MODES.map((value) => ({
  value,
  label: SETTLEMENT_MODE_LABELS[value],
}))

const MONEY_AXIS_BY_MODE: Record<SettlementModeT, MoneyAxisT> = {
  NET: 'net',
  GROSS: 'gross',
  MIXED: 'net',
}

export function settlementModeToMoneyAxis(mode: SettlementModeT): MoneyAxisT {
  return MONEY_AXIS_BY_MODE[mode]
}

// The rate itself is kept rather than cleared: switching back to netto restores the old figures with
// nothing to re-enter.
export function effectiveMaterialsNetRate(
  mode: SettlementModeT,
  rate: number | null,
): number | null {
  return mode === 'GROSS' ? null : rate
}
