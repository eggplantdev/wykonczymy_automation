import { OptionalLink } from '@/components/ui/optional-link'
import { SectionHeader } from '@/components/ui/section-header'
import {
  SUMMARY_NAME_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { EMPTY_VALUE } from '@/lib/utils/empty-value'
import { formatPLDate } from '@/lib/utils/format-date'
import type { EquipmentRowT } from '@/lib/equipment/types'
import { createTranslator } from '@/lib/i18n/translations'
import type { LanguageT } from '@/lib/i18n/languages'

const COLS = `${SUMMARY_NAME_COL} auto ${SUMMARY_VALUE_COL}`

export function HeldEquipmentSection({
  equipment,
  linkable,
  locale,
}: {
  equipment: EquipmentRowT[]
  // `/sprzet/[id]` is management-only, so the worker's own view lists the names as text.
  linkable: boolean
  locale: LanguageT
}) {
  if (equipment.length === 0) return null
  const { t } = createTranslator(locale, 'workerPage')

  return (
    <div>
      <SectionHeader title={t('heldEquipment')} />
      <SummaryTable cols={COLS} className="w-fit text-sm">
        <SummaryHeaderCell>{t('equipment')}</SummaryHeaderCell>
        <SummaryHeaderCell>{t('serialNumber')}</SummaryHeaderCell>
        <SummaryHeaderCell>{t('since')}</SummaryHeaderCell>

        {equipment.map((item) => (
          <div key={item.id} className="contents">
            <SummaryCell>
              <OptionalLink href={linkable ? `/sprzet/${item.id}` : undefined}>
                {item.name}
              </OptionalLink>
            </SummaryCell>
            <SummaryCell>{item.serialNumber || EMPTY_VALUE}</SummaryCell>
            <SummaryCell>{item.locatedAt ? formatPLDate(item.locatedAt) : EMPTY_VALUE}</SummaryCell>
          </div>
        ))}
      </SummaryTable>
    </div>
  )
}
