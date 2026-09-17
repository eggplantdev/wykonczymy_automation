import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { buildV2Columns } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

const DEMOLITION = 7
const PAINTING = 9

const PER_STAGE_IDS = [DEMOLITION, PAINTING].flatMap((id) => [
  stageKey(id),
  stageValueNetKey(id),
  stageValueGrossKey(id),
])

function stage(id: number, ordinal: number, label: string): KosztorysStageT {
  return { id, ordinal, label, plane: 'w_tools', workerId: null }
}

function headerTexts(stages: KosztorysStageT[], stageId: number) {
  const columns = buildV2Columns({ view: 'client', stages, moneyAxis: 'both' })
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

  it('moves all three when the etap is renamed', () => {
    const [qty, net, gross] = headerTexts([stage(DEMOLITION, 1, 'Skuwanie tynków')], DEMOLITION)

    expect(qty).toContain('Skuwanie tynków')
    expect(net).toBe('Skuwanie tynków netto')
    expect(gross).toBe('Skuwanie tynków brutto')
  })

  it('falls back to the etap’s ordinal while it is unnamed', () => {
    const [qty, net] = headerTexts([stage(DEMOLITION, 1, '')], DEMOLITION)

    expect(qty).toContain('Etap 1')
    expect(net).toBe('Etap 1 netto')
  })
})

// The columns are keyed by stage id, so a deletion must take exactly one etap's three columns and
// leave every neighbour's name where it was.
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
    const withStage = buildV2Columns({
      view: 'client',
      stages: [stage(DEMOLITION, 1, 'Rozbiórki')],
      moneyAxis: 'both',
    })
    const perStage = (columns: typeof withStage) =>
      columns.filter((column) => PER_STAGE_IDS.includes(column.id ?? ''))
    expect(perStage(withStage)).toHaveLength(3)

    const emptied = buildV2Columns({ view: 'client', stages: [], moneyAxis: 'both' })

    expect(perStage(emptied)).toEqual([])
  })
})
