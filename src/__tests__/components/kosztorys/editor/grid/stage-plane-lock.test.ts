import { describe, expect, it } from 'vitest'
import { buildV2Columns } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import { STAGE_HEADER_COPY } from '@/components/kosztorys/editor/grid/stage-header-copy'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// An etap with no rozliczenie has its quantity column locked — correct, but a `disabled` dsg cell
// swallows keystrokes without saying why. What is pinned here is that the lock states its reason where
// it is discovered (the cell), not only on the header badge nobody looks at after typing.

const STAGES: KosztorysStageT[] = [
  { id: 7, ordinal: 1, label: 'Bez rozliczenia', plane: null, split: null },
  { id: 9, ordinal: 2, label: 'Rozliczony', plane: 'w_tools', split: null },
]

const ROW = { id: 1, sectionId: 10, [stageKey(7)]: 12 } as unknown as KosztorysV2RowT

const stageColumn = (stageId: number) =>
  buildV2Columns({ view: 'client', stages: STAGES }).find(
    (column) => column.id === stageKey(stageId),
  )

describe('an etap with no rozliczenie', () => {
  it('says why its quantities are locked', () => {
    const { tip } = stageColumn(7)?.columnData as { tip: (r: KosztorysV2RowT) => string }
    expect(tip(ROW)).toBe(STAGE_HEADER_COPY.planeUnconfirmed)
  })

  it('still reads back the quantities already recorded in it', () => {
    const { compute, format } = stageColumn(7)?.columnData as {
      compute: (r: KosztorysV2RowT) => number | null
      format: (value: number | null) => string
    }
    expect(format(compute(ROW))).toBe('12')
    // Blank rather than „0" — an empty locked cell must not read as a measurement of nothing.
    expect(format(compute({ ...ROW, [stageKey(7)]: null } as KosztorysV2RowT))).toBe('')
  })

  it('leaves a rozliczony etap editable', () => {
    expect(stageColumn(7)?.disabled).toBe(true)
    expect(stageColumn(9)?.disabled).toBeFalsy()
  })
})
