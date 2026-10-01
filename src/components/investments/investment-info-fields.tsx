import { ContactLink } from '@/components/ui/contact-link'
import { INVESTMENT_STATUS_LABELS } from '@/lib/constants/investment-status'
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
    // Filtered on the raw field, not the rendered node — a `<ContactLink>` is always truthy, so
    // filtering on it never dropped an empty phone/email.
    {
      label: 'Telefon',
      value: investment.phone && <ContactLink type="phone" value={investment.phone} />,
    },
    {
      label: 'Email',
      value: investment.email && <ContactLink type="email" value={investment.email} />,
    },
    { label: 'Osoba kontaktowa', value: investment.contactPerson },
    // Free text typed in a textarea: its line breaks are the only structure it has.
    {
      label: 'Notatki',
      value: investment.notes && <span className="whitespace-pre-line">{investment.notes}</span>,
    },
    {
      label: 'Opinia',
      value: investment.review && <span className="whitespace-pre-line">{investment.review}</span>,
    },
    { label: 'Status', value: INVESTMENT_STATUS_LABELS[investment.status].pl },
  ].filter((field) => field.value)
}
