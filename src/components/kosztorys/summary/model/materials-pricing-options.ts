import { Banknote, Coins } from 'lucide-react'
import type { SelectOptionT } from '@/components/ui/simple-select'
import type { PricingModeT } from '@/lib/kosztorys/materials-pricing-mode'

// Split from `materials-pricing-mode.ts` the same way `settlement-mode-options.ts` is split from
// `settlement-mode.ts`: the icons are a lucide VALUE import, which must not ride along into whatever
// reaches the mode logic.
export const PRICING_MODE_OPTIONS: SelectOptionT[] = [
  { value: 'gross', label: 'Brutto', icon: Banknote },
  { value: 'net', label: 'Netto', icon: Coins },
]

export const PRICING_MODE_DESCRIPTIONS: Record<PricingModeT, string> = {
  gross: 'Wydatki inwestycyjne rozliczane po kwotach brutto z faktury (domyślne).',
  net: 'Wydatki inwestycyjne rozliczane po kwocie netto z faktury. \nStawkę vat ustawiasz poniżej. Kwota brutto zostanie pomniejszona o vat.',
}

// The server hard-zeroes the concession at tryb brutto (investment-financials.ts), so a stawka set
// there would persist, print a discount and move no figure. Shared by both surfaces that offer the
// choice, so neither can explain the lock differently.
export const MATERIALS_GROSS_LOCK_REASON =
  'Przy rozliczeniu brutto inwestor płaci pełne kwoty z faktur — nie ma czego odliczyć, więc stawka nie ruszyłaby żadnej kwoty. Zmień rozliczenie robocizny na netto lub mieszane, żeby ją ustawić.'
