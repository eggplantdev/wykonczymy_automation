import { describe, expect, it } from 'vitest'
import { buildV2Columns } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

// One etap per plane, so a subcontractor view has both something to keep and something to drop —
// with both planes null every view-scoped assertion below would compare against an empty axis.
const stages: KosztorysStageT[] = [
  { id: 100, ordinal: 1, label: 'Etap 1', plane: 'w_tools', workerId: null },
  { id: 101, ordinal: 2, label: null, plane: 'own_tools', workerId: null },
]

// The editor's own opts: mutation callbacks present, so the actions column is built and cells are live.
const editorOpts: BuildV2ColumnsOptsT = {
  view: 'client',
  stages,
  onRemoveItem: () => {},
  onReorderItem: () => {},
}

const ids = (opts: BuildV2ColumnsOptsT) => buildV2Columns(opts).map((c) => c.id)

describe('readOnly', () => {
  it('disables every column and drops the row-actions column', () => {
    const columns = buildV2Columns({ ...editorOpts, readOnly: true })
    expect(columns.every((c) => c.disabled)).toBe(true)
    expect(columns.map((c) => c.id)).not.toContain('actions')
  })

  it('leaves the editor path untouched when unset', () => {
    const columns = buildV2Columns(editorOpts)
    expect(columns.map((c) => c.id)).toContain('actions')
    // The data cells stay live — this is the regression the flag must not cause.
    expect(columns.some((c) => c.id === 'description' && !c.disabled)).toBe(true)
  })
})

describe('przedmiar-anchored columns', () => {
  // The filter sits at the selection chokepoint, not in the assembly, so a column that starts being
  // built unconditionally can only leak through here — the assertion is on the built grid, never on
  // the set constant, which would just restate itself.
  it('drop their brutto half in a subcontractor view', () => {
    const columns = ids({ ...editorOpts, view: 'w_tools' })
    for (const id of ['plannedGross', 'remainingGross']) {
      expect(columns).not.toContain(id)
    }
  })

  it('keep the przedmiar quantity and its netto figures in a subcontractor view', () => {
    const columns = ids({ ...editorOpts, view: 'w_tools' })
    for (const id of ['plannedQty', 'plannedNet', 'donePercent', 'remaining']) {
      expect(columns).toContain(id)
    }
  })

  it('leaves the view its own etapy — and only its own', () => {
    const columns = ids({ ...editorOpts, view: 'w_tools' })
    expect(columns).toContain('stage_100')
    expect(columns).not.toContain('stage_101')
  })

  it('stay in the client view', () => {
    const columns = ids(editorOpts)
    for (const id of ['plannedQty', 'plannedNet', 'donePercent', 'remaining']) {
      expect(columns).toContain(id)
    }
  })
})
