import { describe, expect, it } from 'vitest'
import { buildV2Columns } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

// A zakończona inwestycja and a client's share link are both `readOnly`, and there the resemblance
// ends: the client is served an ALLOWLIST, the owner keeps his whole document and merely stops
// writing to it. `use-kosztorys-editor.ts` derives `readOnly = preview || locked` while leaving
// `previewVisible: preview` alone, so what this spec pins is that the two flags never move together
// — collapse them back into one and the owner loses two thirds of his columns the day he closes a
// job.

const STAGES: KosztorysStageT[] = [
  { id: 7, ordinal: 1, label: 'Etap 1', plane: null, workerId: null },
  { id: 9, ordinal: 2, label: 'Etap 2', plane: null, workerId: null },
]

// The owner's own editor: mutation callbacks present, so the actions column is built and cells live.
const editorOpts: BuildV2ColumnsOptsT = {
  view: 'client',
  stages: STAGES,
  onRemoveItem: () => {},
  onReorderItem: () => {},
}

const ids = (opts: Partial<BuildV2ColumnsOptsT>): string[] =>
  buildV2Columns({ ...editorOpts, ...opts })
    .map((column) => column.id)
    .filter((id): id is string => id != null)

describe('a locked kosztorys', () => {
  it('renders the same columns as the open editor', () => {
    expect(ids({ readOnly: true })).toEqual(ids({}).filter((id) => id !== 'actions'))
  })

  it('disables every cell and drops the row actions', () => {
    const columns = buildV2Columns({ ...editorOpts, readOnly: true })
    expect(columns.every((column) => column.disabled)).toBe(true)
    expect(columns.map((column) => column.id)).not.toContain('actions')
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
