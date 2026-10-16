import { AiStageSelect } from '@/components/investments/ai-stage-select'
import { ContactLink } from '@/components/ui/contact-link'
import { InvestmentStatusBadge } from '@/components/investments/investment-status-badge'
import {
  formatAddress,
  formatBillingAddress,
  formatBillingParty,
} from '@/lib/investments/format-address'
import type { InvestmentWithDetailsT } from '@/types/reference-data'

export function buildInvestmentInfoFields(
  investment: Pick<
    InvestmentWithDetailsT,
    | 'id'
    | 'address'
    | 'postalCode'
    | 'city'
    | 'country'
    | 'billing'
    | 'phone'
    | 'email'
    | 'contactPerson'
    | 'status'
    | 'reviewRequested'
    | 'aiStage'
  >,
  { isReadOnly = false }: { isReadOnly?: boolean } = {},
) {
  return [
    {
      label: 'Adres',
      value: formatAddress({
        street: investment.address,
        postalCode: investment.postalCode,
        city: investment.city,
        country: investment.country,
      }),
    },
    // Filtered on the raw field, not the rendered node — a `<ContactLink>` is always truthy.
    {
      label: 'Telefon',
      value: investment.phone && <ContactLink type="phone" value={investment.phone} />,
    },
    {
      label: 'Email',
      value: investment.email && <ContactLink type="email" value={investment.email} />,
    },
    { label: 'Osoba kontaktowa', value: investment.contactPerson },
    { label: 'Zamawiający', value: formatBillingParty(investment.billing) },
    { label: 'Adres do umowy', value: formatBillingAddress(investment.billing) },
    { label: 'Status', value: <InvestmentStatusBadge status={investment.status} /> },
    { label: 'Opinia', value: investment.reviewRequested && 'Wysłano' },
    {
      label: 'Etap AI',
      value: !isReadOnly && (
        <AiStageSelect investmentId={investment.id} aiStage={investment.aiStage} />
      ),
    },
  ].filter((field) => field.value)
}
