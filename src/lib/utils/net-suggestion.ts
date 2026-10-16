import { netFromGross } from '@/lib/kosztorys/net-gross-amounts'

export function netSuggestion(
  currentNet: string,
  gross: string,
  lastSuggested: string | null,
  rate: number,
): string | null {
  if (currentNet !== '' && currentNet !== lastSuggested) return null
  return netFromGross(gross, rate)
}
