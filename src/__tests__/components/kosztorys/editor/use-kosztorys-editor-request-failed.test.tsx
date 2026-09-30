import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import {
  createUndoRedoStack,
  type UndoRedoApiT,
} from '@/components/kosztorys/editor/hooks/use-undo-redo'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'
import { removeItemAction, swapItemOrderAction } from '@/lib/actions/kosztorys'
import { toastMessage } from '@/lib/utils/toast'

vi.mock('@/lib/actions/kosztorys', () => ({
  addItemAction: vi.fn(),
  addSectionAction: vi.fn(),
  insertItemAction: vi.fn(),
  insertSectionAction: vi.fn(),
  removeItemAction: vi.fn(),
  removeSectionAction: vi.fn(),
  renumberKosztorysOrderAction: vi.fn(),
  setStageProgressAction: vi.fn(),
  swapItemOrderAction: vi.fn(),
  swapSectionOrderAction: vi.fn(),
  updateItemFieldAction: vi.fn(),
  updateSectionFieldAction: vi.fn(),
  updateInvestmentCoeffsAction: vi.fn(),
  updateInvestmentGlobalDiscountAction: vi.fn(),
  updateInvestmentMaterialsNetRateAction: vi.fn(),
  updateInvestmentSettlementModeAction: vi.fn(),
  updateInvestmentVatAction: vi.fn(),
  applyPercentDiscountToAllItemsAction: vi.fn(),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

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

const TREE = makeTree({
  sections: [
    {
      id: 10,
      name: 'Salon',
      displayOrder: 0,
      color: null,
      items: [
        { ...baseItem, id: 1, description: 'Malowanie', plannedQty: 1, clientPrice: 100 },
        { ...baseItem, id: 2, description: 'Gruntowanie', displayOrder: 1, plannedQty: 1, clientPrice: 50 },
      ],
    },
  ],
})

function renderEditor() {
  const stack = createUndoRedoStack()
  const undoRedo: UndoRedoApiT = {
    push: (command) => stack.push(command),
    undo: () => void stack.undo()?.undo(),
    redo: () => void stack.redo()?.redo(),
    canUndo: false,
    canRedo: false,
    revision: 0,
    reset: () => stack.reset(),
    pruneByIds: (ids) => stack.pruneByIds(ids),
    amendTop: (expected, replacement) => stack.amendTop(expected, replacement),
  }
  const hook = renderHook(() => useKosztorysEditor({ investmentId: 1, tree: TREE, undoRedo }))
  return { ...hook, stack }
}

const rowIds = (result: { current: ReturnType<typeof useKosztorysEditor> }) =>
  result.current.rows.map((row) => row.id)

const offline = () => Promise.reject(new TypeError('Failed to fetch'))

describe('edytor kosztorysu — żądanie, które nie dotarło (EX-940)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('puts a moved pozycja back and leaves nothing to undo', async () => {
    vi.mocked(swapItemOrderAction).mockImplementation(offline)
    const { result, stack } = renderEditor()
    const second = result.current.rows.find((row) => row.id === 2)

    await act(async () => {
      if (second) grid.opts?.onReorderItem?.(second, 'up')
    })

    expect(swapItemOrderAction).toHaveBeenCalledWith(2, 'up')
    expect(rowIds(result)).toEqual([1, 2])
    expect(stack.undoDepth).toBe(0)
    expect(toastMessage).toHaveBeenCalledWith(
      expect.stringMatching(/Brak połączenia z serwerem/),
      'error',
      5000,
    )
  })

  it('brings a removed pozycja back', async () => {
    vi.mocked(removeItemAction).mockImplementation(offline)
    const { result } = renderEditor()
    const first = result.current.rows.find((row) => row.id === 1)

    await act(async () => {
      if (first) await grid.opts?.onRemoveItem?.(first)
    })

    expect(rowIds(result)).toEqual([1, 2])
    expect(toastMessage).toHaveBeenCalledWith(
      expect.stringMatching(/Brak połączenia z serwerem/),
      'error',
      5000,
    )
  })
})
