import { describe, expect, it } from 'vitest'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { gridColumnIds, STAGES_7_9 } from '@/__tests__/helpers/grid-columns'

// what this spec pins is that the two flags never move together — collapse them back into one and
// the owner loses two thirds of his columns the day he closes a job.

const editorOpts: BuildV2ColumnsOptsT = {
  view: 'client',
  stages: STAGES_7_9,
  onRemoveItem: () => {},
}

const ids = (opts: Partial<BuildV2ColumnsOptsT>): string[] =>
  gridColumnIds({ ...editorOpts, ...opts })

describe('a locked kosztorys', () => {
  it('renders the same columns as the open editor', () => {
    expect(ids({ readOnly: true })).toEqual(ids({}).filter((id) => id !== 'actions'))
  })

  // The control that makes the first assertion mean something: `previewVisible` DOES narrow, so
  // „same columns" above is a property of the lock, not of a grid that never narrows.
  it('keeps the columns a client would never be served', () => {
    const locked = ids({ readOnly: true })
    const client = ids({ readOnly: true, previewVisible: true })
    expect(client.length).toBeLessThan(locked.length)
    for (const id of client) expect(locked).toContain(id)
  })
})
