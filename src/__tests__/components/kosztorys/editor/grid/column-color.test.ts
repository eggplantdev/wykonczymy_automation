import { describe, expect, it } from 'vitest'
import type { Column } from 'react-datasheet-grid'
import { withColumnColor } from '@/components/kosztorys/editor/grid/column-color'
import { sectionColorColumnTint } from '@/lib/kosztorys/section-colors'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

const stage = (id: number, completed: boolean): KosztorysStageT => ({
  id,
  ordinal: id,
  label: null,
  plane: 'w_tools',
  split: null,
  completed,
})

const DONE = 7
const OPEN = 9
const STAGES = [stage(DONE, true), stage(OPEN, false)]

const GREEN = sectionColorColumnTint('green')
const BLUE = sectionColorColumnTint('blue')

const columnsOf = (stageId: number) => [
  stageKey(stageId),
  stageValueNetKey(stageId),
  stageValueGrossKey(stageId),
]

const classesOf = (id: string, columnColors?: Record<string, 'blue'>) => {
  const col = withColumnColor({ id } as Column<KosztorysV2RowT>, { stages: STAGES, columnColors })
  return { cell: String(col.cellClassName ?? ''), header: String(col.headerClassName ?? '') }
}

describe('withColumnColor — etap zakończony (EX-1034)', () => {
  it.each(columnsOf(DONE))('tints %s of a zakończony etap green, cell and header', (id) => {
    const { cell, header } = classesOf(id)

    for (const classes of [cell, header]) {
      expect(classes).toContain('kosztorys-column-tint')
      expect(classes).toContain(GREEN)
    }
  })

  it.each(columnsOf(OPEN))('leaves %s of an open etap untinted', (id) => {
    expect(classesOf(id)).toEqual({ cell: '', header: '' })
  })

  it('outranks the owner’s own colour on a zakończony etap, and only there', () => {
    const done = classesOf(stageKey(DONE), { [stageKey(DONE)]: 'blue' })
    expect(done.cell).toContain(GREEN)
    expect(done.cell).not.toContain(BLUE)

    expect(classesOf(stageKey(OPEN), { [stageKey(OPEN)]: 'blue' }).cell).toContain(BLUE)
  })
})
