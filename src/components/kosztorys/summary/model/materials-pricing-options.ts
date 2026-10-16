import { Banknote, Coins } from 'lucide-react'
import type { SelectOptionT } from '@/components/ui/simple-select'
import type { PricingModeT } from '@/lib/kosztorys/materials-pricing-mode'

export const PRICING_MODE_OPTIONS: SelectOptionT[] = [
  { value: 'gross', label: 'Brutto', icon: Banknote },
  { value: 'net', label: 'Netto', icon: Coins },
]

export const PRICING_MODE_DESCRIPTIONS: Record<PricingModeT, string> = {
  gross: 'Wydatki inwestycyjne rozliczane po kwotach brutto z faktury (domyślne).',
  net: 'Wydatki inwestycyjne rozliczane po kwocie netto z faktury. \nStawkę vat ustawiasz poniżej. Kwota brutto zostanie pomniejszona o vat.',
}

// The server hard-zeroes the concession at tryb brutto (investment-financials.ts), so a stawka set
// there would persist, print a discount and move no figure.
export const MATERIALS_GROSS_LOCK_REASON =
  'Przy rozliczeniu brutto inwestor płaci pełne kwoty z faktur — nie ma czego odliczyć, więc stawka nie ruszyłaby żadnej kwoty. Zmień rozliczenie robocizny na netto lub mieszane, żeby ją ustawić.'
