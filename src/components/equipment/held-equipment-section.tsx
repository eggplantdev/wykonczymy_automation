import { OptionalLink } from '@/components/ui/optional-link'
import { SectionHeader } from '@/components/ui/section-header'
import {
  SUMMARY_NAME_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { formatPLDate } from '@/lib/utils/format-date'
import type { EquipmentRowT } from '@/lib/equipment/types'
import { createTranslator } from '@/lib/i18n/translations'
import type { LanguageT } from '@/lib/i18n/languages'

const COLS = `${SUMMARY_NAME_COL} auto ${SUMMARY_VALUE_COL}`

/**
 * What one person (or one warehouse) is holding — the question that gets asked at a rozliczenie or
 * when somebody leaves. No actions on purpose: handing an item on happens on the item's own page, so
 * that one operation keeps one entry point and one validation path.
 */
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
        <SummaryHeaderCell variant="label">{t('equipment')}</SummaryHeaderCell>
        <SummaryHeaderCell variant="label">{t('serialNumber')}</SummaryHeaderCell>
        <SummaryHeaderCell variant="label">{t('since')}</SummaryHeaderCell>

        {equipment.map((item) => (
          <div key={item.id} className="contents">
            <SummaryLabelCell>
              <OptionalLink href={linkable ? `/sprzet/${item.id}` : undefined}>
                {item.name}
              </OptionalLink>
            </SummaryLabelCell>
            <SummaryLabelCell>{item.serialNumber || '—'}</SummaryLabelCell>
            <SummaryLabelCell>
              {item.locatedAt ? formatPLDate(item.locatedAt) : '—'}
            </SummaryLabelCell>
          </div>
        ))}
      </SummaryTable>
    </div>
  )
}
