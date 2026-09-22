import { ContactLink } from '@/components/ui/contact-link'
import { STATUS_LABELS } from '@/components/investments/investment-status-badge'
import type { InvestmentRefT } from '@/types/reference-data'

// One list for two surfaces — the investment card and the editor's „Inwestycja" tab. Written out
// twice they drifted on the first added field, with no type error and no test to catch it.
export function buildInvestmentInfoFields(
  investment: Pick<
    InvestmentRefT,
    'address' | 'phone' | 'email' | 'contactPerson' | 'notes' | 'review' | 'status'
  >,
) {
  return [
    { label: 'Adres', value: investment.address },
    { label: 'Telefon', value: <ContactLink type="phone" value={investment.phone} /> },
    { label: 'Email', value: <ContactLink type="email" value={investment.email} /> },
    { label: 'Osoba kontaktowa', value: investment.contactPerson },
    { label: 'Notatki', value: investment.notes },
    { label: 'Opinia', value: investment.review || '—' },
    { label: 'Status', value: STATUS_LABELS[investment.status] },
  ].filter((field) => field.value)
}
