import { toNet } from '@/lib/kosztorys/calc'
import { roundToCents } from '@/lib/utils/round-to-cents'

export const netFromGross = (gross: string, vatRate: number): string => {
  const amount = Number(gross)
  if (gross === '' || !Number.isFinite(amount)) return ''
  return roundToCents(toNet(amount, vatRate)).toFixed(2)
}
