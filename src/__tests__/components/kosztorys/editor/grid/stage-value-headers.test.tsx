import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { buildV2Grid } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

const DEMOLITION = 7
const PAINTING = 9

const PER_STAGE_IDS = [DEMOLITION, PAINTING].flatMap((id) => [
  stageKey(id),
  stageValueNetKey(id),
  stageValueGrossKey(id),
])

function stage(id: number, ordinal: number, label: string): KosztorysStageT {
  return makeStage({ id, ordinal, label })
}

function headerTexts(stages: KosztorysStageT[], stageId: number) {
  const columns = buildV2Grid({ view: 'client', stages, moneyAxis: 'both' }).columns
  const ids = [stageKey(stageId), stageValueNetKey(stageId), stageValueGrossKey(stageId)]
  return ids.map((id) => {
    const column = columns.find((c) => c.id === id)
    if (!column) return null
    const { container } = render(<>{column.title}</>)
    return container.textContent
  })
}

describe('per-stage columns — one name, three headers', () => {
  it('names every one of an etap’s columns after the etap', () => {
    const [qty, net, gross] = headerTexts([stage(DEMOLITION, 1, 'Rozbiórki')], DEMOLITION)

    expect(qty).toContain('Rozbiórki')
    expect(net).toBe('Rozbiórki netto')
    expect(gross).toBe('Rozbiórki brutto')
  })

  it('falls back to the etap’s ordinal while it is unnamed', () => {
    const [qty, net] = headerTexts([stage(DEMOLITION, 1, '')], DEMOLITION)

    expect(qty).toContain('Etap 1')
    expect(net).toBe('Etap 1 netto')
  })
})

describe('per-stage columns — an etap is deleted', () => {
  it('takes all three of its columns and leaves the survivor’s names alone', () => {
    const stages = [stage(DEMOLITION, 1, 'Rozbiórki'), stage(PAINTING, 2, 'Malowanie')]
    expect(headerTexts(stages, PAINTING)).toEqual([
      'Malowanie',
      'Malowanie netto',
      'Malowanie brutto',
    ])

    const afterDelete = [stage(PAINTING, 2, 'Malowanie')]

    expect(headerTexts(afterDelete, DEMOLITION)).toEqual([null, null, null])
    const [qty, net, gross] = headerTexts(afterDelete, PAINTING)
    expect(qty).toContain('Malowanie')
    expect(net).toBe('Malowanie netto')
    expect(gross).toBe('Malowanie brutto')
  })

  it('renders no per-etap column at all once the last one is gone', () => {
    const withStage = buildV2Grid({
      view: 'client',
      stages: [stage(DEMOLITION, 1, 'Rozbiórki')],
      moneyAxis: 'both',
    }).columns
    const perStage = (columns: typeof withStage) =>
      columns.filter((column) => PER_STAGE_IDS.includes(column.id ?? ''))
    expect(perStage(withStage)).toHaveLength(3)

    const emptied = buildV2Grid({ view: 'client', stages: [], moneyAxis: 'both' }).columns

    expect(perStage(emptied)).toEqual([])
  })
})
