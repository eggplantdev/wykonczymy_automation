import Link from 'next/link'
import {
  SUMMARY_LABEL_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { Description } from '@/components/ui/description'
import { formatPLDate } from '@/lib/utils/format-date'
import type { EquipmentRowT } from '@/lib/equipment/types'

const COLS = `${SUMMARY_LABEL_COL} 1fr 9rem`

/**
 * What one person (or one warehouse) is holding — the question that gets asked at a rozliczenie or
 * when somebody leaves. No actions on purpose: handing an item on happens on the item's own page, so
 * that one operation keeps one entry point and one validation path.
 */
export function HeldEquipmentSection({ equipment }: { equipment: EquipmentRowT[] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">Na stanie</h2>

      {equipment.length === 0 ? (
        <Description>Nie ma nic na stanie.</Description>
      ) : (
        <SummaryTable cols={COLS}>
          <SummaryHeaderCell variant="label">Sprzęt</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">Nr seryjny</SummaryHeaderCell>
          <SummaryHeaderCell variant="label">Od</SummaryHeaderCell>

          {equipment.map((item) => (
            <div key={item.id} className="contents">
              <SummaryLabelCell>
                <Link href={`/sprzet/${item.id}`} className="hover:underline">
                  {item.name}
                </Link>
              </SummaryLabelCell>
              <SummaryLabelCell>{item.serialNumber || '—'}</SummaryLabelCell>
              <SummaryLabelCell>
                {item.locatedAt ? formatPLDate(item.locatedAt) : '—'}
              </SummaryLabelCell>
            </div>
          ))}
        </SummaryTable>
      )}
    </div>
  )
}
