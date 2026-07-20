import { describe, expect, it } from 'vitest'
import { buildV2Columns } from '@/components/kosztorys/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/kosztorys-v2-column-opts'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

const stages: KosztorysStageT[] = [
  { id: 100, ordinal: 1, label: 'Etap 1' },
  { id: 101, ordinal: 2, label: null },
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

describe('clientVisible', () => {
  it('drops the subcontractor columns even when the grid is built at a subcontractor view', () => {
    // Belt AND braces: the client render pins view 'client' so these are never assembled, but the
    // filter must hold on its own — it is the lock that survives a future caller passing a view.
    const columns = ids({ ...editorOpts, view: 'w_tools', clientVisible: true, readOnly: true })
    expect(columns).not.toContain('priceMode')
    expect(columns).not.toContain('priceCoeff')
  })

  it('keeps the offer + progress columns the client is meant to read', () => {
    const columns = ids({ ...editorOpts, clientVisible: true, readOnly: true })
    for (const id of ['description', 'plannedQty', 'unit', 'price', 'net', 'stageQtySum', 'note']) {
      expect(columns).toContain(id)
    }
    // Per-etap quantity columns are namespaced per stage id, not by the group key.
    expect(columns).toContain('stage_100')
  })

  it('is a no-op for the editor, which passes no flag', () => {
    expect(ids({ ...editorOpts, view: 'w_tools' })).toContain('priceMode')
  })
})
