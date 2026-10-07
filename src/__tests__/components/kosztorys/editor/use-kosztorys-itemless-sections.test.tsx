import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import type { UndoRedoApiT } from '@/components/kosztorys/editor/hooks/use-undo-redo'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'
import { stackUndoRedo } from '@/__tests__/helpers/kosztorys-undo-redo'
import type { KosztorysItemT } from '@/lib/kosztorys/types'
import {
  addSectionAction,
  removeItemAction,
  removeSectionAction,
  updateSectionFieldAction,
} from '@/lib/actions/kosztorys'

vi.mock('@/lib/actions/kosztorys', () => ({
  addSectionAction: vi.fn(),
  insertSectionAction: vi.fn(),
  removeItemAction: vi.fn(async () => ({ success: true })),
  removeSectionAction: vi.fn(async () => ({ success: true })),
  renumberKosztorysOrderAction: vi.fn(),
  setStageProgressAction: vi.fn(),
  updateItemFieldAction: vi.fn(async () => ({ success: true })),
  updateSectionFieldAction: vi.fn(async () => ({ success: true })),
  updateInvestmentCoeffsAction: vi.fn(),
  updateInvestmentGlobalDiscountAction: vi.fn(),
  updateInvestmentMaterialsNetRateAction: vi.fn(),
  updateInvestmentSettlementModeAction: vi.fn(),
  updateInvestmentVatAction: vi.fn(),
  applyPercentDiscountToAllItemsAction: vi.fn(),
}))

// The row-level handlers reach the grid only through the column opts, never the hook's return.
const grid = vi.hoisted(() => ({ opts: undefined as BuildV2ColumnsOptsT | undefined }))
vi.mock('@/components/kosztorys/editor/grid/kosztorys-v2-columns', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/components/kosztorys/editor/grid/kosztorys-v2-columns')>()
  return {
    ...actual,
    buildV2Grid: (opts: BuildV2ColumnsOptsT) => {
      grid.opts = opts
      return actual.buildV2Grid(opts)
    },
  }
})

// Salon has one pozycja, Kuchnia none, Łazienka one — the itemless sekcja sits between two blocks.
const TREE = makeTree({
  sections: [
    {
      id: 10,
      name: 'Salon',
      displayOrder: 0,
      color: null,
      items: [{ ...baseItem, id: 1, description: 'Malowanie', plannedQty: 1, clientPrice: 100 }],
    },
    { id: 20, name: 'Kuchnia', displayOrder: 1, color: null, items: [] },
    {
      id: 30,
      name: 'Łazienka',
      displayOrder: 2,
      color: null,
      items: [
        {
          ...baseItem,
          id: 3,
          sectionId: 30,
          description: 'Fugowanie',
          plannedQty: 1,
          clientPrice: 50,
        },
      ],
    },
  ],
})

function renderEditor(undoRedo: UndoRedoApiT = stackUndoRedo().api) {
  return renderHook(() => useKosztorysEditor({ investmentId: 1, tree: TREE, undoRedo }))
}

const sectionIds = (result: { current: ReturnType<typeof useKosztorysEditor> }) =>
  result.current.sections.map((section) => section.sectionId)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sekcja bez pozycji w edytorze', () => {
  it('stands in the section list although no row carries it', () => {
    const { result } = renderEditor()

    expect(sectionIds(result)).toEqual([10, 20, 30])
    expect(result.current.rows.some((row) => row.sectionId === 20)).toBe(false)
  })

  it('survives the removal of its last pozycja, without a section delete', async () => {
    const { result } = renderEditor()
    const lastOfSalon = result.current.rows.find((row) => row.id === 1)

    await act(async () => {
      if (lastOfSalon) await grid.opts?.onRemoveItem?.(lastOfSalon)
    })

    expect(removeItemAction).toHaveBeenCalledWith(1)
    expect(removeSectionAction).not.toHaveBeenCalled()
    expect(sectionIds(result)).toEqual([10, 20, 30])
    expect(result.current.rows.map((row) => row.id)).toEqual([3])
  })

  it('adds a bare section at the top, with no row for it', async () => {
    vi.mocked(addSectionAction).mockResolvedValue({
      success: true,
      data: { section: { id: 40, displayOrder: -1 } },
    })
    const { result } = renderEditor()

    let createdId: number | undefined
    await act(async () => {
      createdId = await result.current.handleAddSection()
    })

    expect(createdId).toBe(40)
    expect(sectionIds(result)).toEqual([40, 10, 20, 30])
    expect(result.current.rows.map((row) => row.id)).toEqual([1, 3])
  })

  // What the „Nowa praca" dialog hands back once the server has saved the praca.
  const savedItem = (id: number, sectionId: number): KosztorysItemT => ({
    ...baseItem,
    id,
    sectionId,
    description: 'Nowa praca',
    plannedQty: 0,
    clientPrice: 80,
  })

  it('opens the dialog for the end of the sekcja', () => {
    const { result } = renderEditor()
    const open = vi.fn()
    result.current.newItemDialogRef.current = open

    act(() => result.current.handleAddItem(20))

    expect(open).toHaveBeenCalledWith({ kind: 'end', sectionId: 20 })
  })

  it('places the first pozycja of the middle itemless section between its neighbours', () => {
    const { result } = renderEditor()

    act(() => result.current.placeNewItem(savedItem(2, 20), { kind: 'end', sectionId: 20 }))

    expect(result.current.rows.map((row) => row.id)).toEqual([1, 2, 3])
    expect(result.current.rows[1]).toMatchObject({
      sectionId: 20,
      sectionName: 'Kuchnia',
      description: 'Nowa praca',
    })
  })

  it('keeps a first pozycja under its own band when the last one went while the dialog was open', async () => {
    const { result } = renderEditor()
    const lastOfSalon = result.current.rows.find((row) => row.id === 1)

    await act(async () => {
      if (lastOfSalon) await grid.opts?.onRemoveItem?.(lastOfSalon)
    })
    act(() => result.current.placeNewItem(savedItem(2, 10), { kind: 'end', sectionId: 10 }))

    expect(result.current.rows.map((row) => row.id)).toEqual([2, 3])
  })

  it('places a praca next to its anchor', () => {
    const { result } = renderEditor()

    act(() =>
      result.current.placeNewItem(savedItem(4, 30), {
        kind: 'next-to',
        anchorItemId: 3,
        dir: 'above',
      }),
    )

    expect(result.current.rows.map((row) => row.id)).toEqual([1, 4, 3])
  })

  it('shows itemless bands despite a persisted id of a condition that no longer exists', () => {
    localStorage.setItem('kosztorys-filters:1', JSON.stringify({ 'removed-condition': true }))
    const { result } = renderEditor()

    expect(result.current.showItemless).toBe(true)
    localStorage.clear()
  })

  it('renames an itemless section in the list and persists it', async () => {
    const { result } = renderEditor()

    act(() => {
      result.current.onRenameSection?.(20, 'Przedpokój')
    })

    expect(result.current.sections[1]).toMatchObject({ sectionId: 20, sectionName: 'Przedpokój' })
    await waitFor(() =>
      expect(updateSectionFieldAction).toHaveBeenCalledWith(20, { name: 'Przedpokój' }),
    )
  })

  // With no rows the section's own commands carry no item id, so only the header id can prune them;
  // replaying one after the delete would write against a dead section.
  it('drops its rename from the undo stack when the section is removed', async () => {
    const { stack, api } = stackUndoRedo()
    const { result } = renderEditor(api)

    act(() => {
      result.current.onRenameSection?.(20, 'Przedpokój')
    })
    expect(stack.undoDepth).toBe(1)

    await act(async () => {
      await result.current.onRemoveSection?.(20)
    })

    expect(removeSectionAction).toHaveBeenCalledWith(20)
    expect(stack.undoDepth).toBe(0)
    expect(sectionIds(result)).toEqual([10, 30])
  })
})
