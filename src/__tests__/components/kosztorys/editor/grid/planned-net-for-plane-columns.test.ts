import { describe, expect, it } from 'vitest'
import { buildV2Grid } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { columnLabelForView } from '@/lib/kosztorys/columns/column-config'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

const STAGES: KosztorysStageT[] = [
  makeStage({ id: 7, label: 'Etap 1' }),
  makeStage({ id: 8, ordinal: 2, label: 'Etap 2', plane: 'own_tools' }),
]

function grid(view: PriceViewT, extra: Partial<BuildV2ColumnsOptsT> = {}) {
  const { columns, columnToggleItems } = buildV2Grid({ view, stages: STAGES, ...extra })
  return {
    ids: columns.map((column) => column.id),
    toggleIds: columnToggleItems.map((item) => item.id),
  }
}

describe('plannedNetForPlane column', () => {
  it.each(['w_tools', 'own_tools'] as const)('renders and is pickable in the %s view', (view) => {
    const { ids, toggleIds } = grid(view)
    expect(ids).toContain('plannedNetForPlane')
    expect(toggleIds).toContain('plannedNetForPlane')
    expect(ids).toContain('plannedNet')
  })

  it('never reaches the client view, not even with every preference switched on', () => {
    const { ids, toggleIds } = grid('client', { isHidden: () => false, moneyAxis: 'both' })
    expect(ids).not.toContain('plannedNetForPlane')
    expect(toggleIds).not.toContain('plannedNetForPlane')
  })

  it('names its plane, so it cannot be mistaken for the client-priced twin', () => {
    expect(columnLabelForView('plannedNetForPlane', 'w_tools')).not.toBe(
      columnLabelForView('plannedNet', 'w_tools'),
    )
    expect(columnLabelForView('plannedNetForPlane', 'w_tools')).toMatch(
      /^Wartość netto aktualizacji przedmiaru — /,
    )
  })
})
