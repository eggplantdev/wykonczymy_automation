import { Fragment } from 'react'
import { OptionalLink } from '@/components/ui/optional-link'
import {
  SUMMARY_NAME_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { Description } from '@/components/ui/description'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { formatPLN } from '@/lib/utils/format-currency'
import type { RegisterBalanceMapT } from '@/lib/queries/balances'
import type { CashRegisterRefT } from '@/types/reference-data'
import { createTranslator } from '@/lib/i18n/translations'
import type { LanguageT } from '@/lib/i18n/languages'

const COLS = `${SUMMARY_NAME_COL} ${SUMMARY_VALUE_COL}`

// An inactive kasa is still listed: it goes to the Kosz with its owner like any other.
export function OwnedRegistersSection({
  registers,
  balances,
  linkable,
  locale,
}: {
  registers: CashRegisterRefT[]
  balances: RegisterBalanceMapT
  // `/kasa/[id]` is management-only, so the worker's own view lists the names as text.
  linkable: boolean
  locale: LanguageT
}) {
  const { t } = createTranslator(locale, 'workerPage')
  const rows = registers.map((register) => ({
    ...register,
    balance: balances[String(register.id)] ?? 0,
  }))
  const total = rows.reduce((sum, row) => sum + row.balance, 0)

  return (
    <CollapsibleSection
      title={t('myRegisters')}
      storageKey="worker:registers"
      withSeparator={false}
    >
      {rows.length === 0 ? (
        <Description>{t('noRegisters')}</Description>
      ) : (
        <SummaryTable cols={COLS} className="w-fit text-sm">
          <SummaryHeaderCell variant="label">{t('register')}</SummaryHeaderCell>
          <SummaryHeaderCell>{t('balance')}</SummaryHeaderCell>
          {rows.map((row) => (
            <Fragment key={row.id}>
              <SummaryLabelCell note={row.active ? null : { text: t('registerInactive') }}>
                <OptionalLink href={linkable ? `/kasa/${row.id}` : undefined}>
                  {row.name}
                </OptionalLink>
              </SummaryLabelCell>
              <SummaryValueCell tone={row.balance < 0 ? 'error' : 'default'}>
                {formatPLN(row.balance)}
              </SummaryValueCell>
            </Fragment>
          ))}
          <SummaryLabelCell weight="bold">{t('total')}</SummaryLabelCell>
          <SummaryValueCell weight="bold" tone={total < 0 ? 'error' : 'default'}>
            {formatPLN(total)}
          </SummaryValueCell>
        </SummaryTable>
      )}
    </CollapsibleSection>
  )
}
