import { OptionalLink } from '@/components/ui/optional-link'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { formatPLDate } from '@/lib/utils/format-date'
import type { EquipmentRowT } from '@/lib/equipment/types'

const COLS = `${SUMMARY_LABEL_COL} 1fr ${SUMMARY_VALUE_COL}`

/**
 * What one person (or one warehouse) is holding — the question that gets asked at a rozliczenie or
 * when somebody leaves. No actions on purpose: handing an item on happens on the item's own page, so
 * that one operation keeps one entry point and one validation path.
 */
export function HeldEquipmentSection({
  equipment,
  linkable,
}: {
  equipment: EquipmentRowT[]
  // `/sprzet/[id]` is management-only, so the worker's own view lists the names as text.
  linkable: boolean
}) {
  if (equipment.length === 0) return null

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">Na stanie</h2>

      <SummaryTable cols={COLS}>
        <SummaryHeaderCell variant="label">Sprzęt</SummaryHeaderCell>
        <SummaryHeaderCell variant="label">Nr seryjny</SummaryHeaderCell>
        <SummaryHeaderCell variant="label">Od</SummaryHeaderCell>

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
