import { Banknote, Coins, Split, type LucideIcon } from 'lucide-react'
import { SETTLEMENT_MODE_OPTIONS, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'

export const SETTLEMENT_MODE_DESCRIPTIONS: Partial<Record<SettlementModeT, string>> = {
  MIXED:
    'Klient płaci obiema drogami — częściowo gotówką, częściowo przelewem na fakturę. Rachunek zostaje jeden, liczony netto; żadna z tych wpłat nie jest oznaczona jako niezgodna.',
}

// Hung here rather than on SETTLEMENT_MODE_OPTIONS itself: that module is reached from the Payload
// collection config, where a lucide value import would land in `payload generate:types`.
const MODE_ICONS: Record<SettlementModeT, LucideIcon> = {
  NET: Coins,
  GROSS: Banknote,
  MIXED: Split,
}

export const SETTLEMENT_MODE_SELECT_OPTIONS = SETTLEMENT_MODE_OPTIONS.map((option) => ({
  ...option,
  icon: MODE_ICONS[option.value],
}))
