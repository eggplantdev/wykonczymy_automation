import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import { item, tree } from '@/__tests__/helpers/kosztorys-history'
import { stackUndoRedo } from '@/__tests__/helpers/kosztorys-undo-redo'

const TREE = tree([item(1, 'Płytki', 12, 100), item(2, 'Fugi', 8, 50), item(3, 'Płyta GK', 4, 20)])

function renderEditor() {
  return renderHook(() =>
    useKosztorysEditor({
      investmentId: 1,
      tree: TREE,
      undoRedo: stackUndoRedo().api,
      preview: false,
    }),
  )
}

const visibleIds = (result: { current: ReturnType<typeof useKosztorysEditor> }) =>
  result.current.viewRows.map((row) => row.id)

describe('the view under a search phrase', () => {
  it('keeps a pozycja whose opis stops matching until the phrase changes', () => {
    const { result } = renderEditor()

    act(() => result.current.setSearch('płyt'))
    expect(visibleIds(result)).toEqual([1, 3])

    act(() =>
      result.current.onChange(
        result.current.rows.map((row) => (row.id === 1 ? { ...row, description: 'Kafle' } : row)),
      ),
    )
    expect(visibleIds(result)).toEqual([1, 3])

    act(() => result.current.setSearch('płyta'))
    expect(visibleIds(result)).toEqual([3])
  })
})
