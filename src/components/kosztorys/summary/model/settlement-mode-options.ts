import { Banknote, Coins, Split, type LucideIcon } from 'lucide-react'
import { SETTLEMENT_MODE_OPTIONS, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'

// Only Mieszane earns a hint: „Brutto"/„Netto" say what they do, but Mieszane is the one mode whose
// meaning sits outside this control — in the forma of each wpłata. Naming the wydatek here instead
// (as this copy did until 2026-08-08) pointed at a different netto/brutto switch entirely: the
// wydatek's own type, which applies in EVERY mode and which this one does not turn on.
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

// One options array for every surface that edits the mode — the popover section and the inline
// control in the Podsumowanie tab — so the two can never offer different modes or different icons.
export const SETTLEMENT_MODE_SELECT_OPTIONS = SETTLEMENT_MODE_OPTIONS.map((option) => ({
  ...option,
  icon: MODE_ICONS[option.value],
}))
