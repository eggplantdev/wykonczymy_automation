import { AiStageSelect } from '@/components/investments/ai-stage-select'
import { ContactLink } from '@/components/ui/contact-link'
import { InvestmentStatusBadge } from '@/components/investments/investment-status-badge'
import type { InvestmentRefT } from '@/types/reference-data'

// One list for two surfaces — the investment card and the editor's „Inwestycja" tab. Written out
// twice they drifted on the first added field, with no type error and no test to catch it.
export function buildInvestmentInfoFields(
  investment: Pick<
    InvestmentRefT,
    | 'id'
    | 'address'
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
