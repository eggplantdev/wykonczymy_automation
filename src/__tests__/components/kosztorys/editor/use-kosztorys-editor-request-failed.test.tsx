import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'
import { stackUndoRedo } from '@/__tests__/helpers/kosztorys-undo-redo'
import { removeItemAction, updateItemFieldAction } from '@/lib/actions/kosztorys'
import { toastMessage } from '@/lib/utils/toast'

vi.mock('@/lib/actions/kosztorys', () => ({
  clearKosztorysAction: vi.fn(),
  writeKosztorysLayoutAction: vi.fn(),
  addItemAction: vi.fn(),
  addSectionAction: vi.fn(),
  insertItemAction: vi.fn(),
  insertSectionAction: vi.fn(),
  removeItemAction: vi.fn(),
  removeSectionAction: vi.fn(),
  renumberKosztorysOrderAction: vi.fn(),
  setStageProgressAction: vi.fn(),
  updateItemFieldAction: vi.fn(),
  updateSectionFieldAction: vi.fn(),
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

const TREE = makeTree({
  sections: [
    {
      id: 10,
      name: 'Salon',
      displayOrder: 0,
      color: null,
      items: [
        { ...baseItem, id: 1, description: 'Malowanie', plannedQty: 1, clientPrice: 100 },
        {
          ...baseItem,
          id: 2,
          description: 'Gruntowanie',
          displayOrder: 1,
          plannedQty: 1,
          clientPrice: 50,
        },
      ],
    },
  ],
})

function renderEditor() {
  const { api } = stackUndoRedo()
  return renderHook(() => useKosztorysEditor({ investmentId: 1, tree: TREE, undoRedo: api }))
}

const rowIds = (result: { current: ReturnType<typeof useKosztorysEditor> }) =>
  result.current.rows.map((row) => row.id)

const offline = () => Promise.reject(new TypeError('Failed to fetch'))

describe('edytor kosztorysu — żądanie, które nie dotarło', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
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

describe('edytor kosztorysu — zapis odrzucony przez serwer', () => {
  it('puts the cell and the totals back on what the database holds', async () => {
    vi.mocked(updateItemFieldAction).mockResolvedValue({ success: false, error: 'Zapis odrzucony' })
    const { result } = renderEditor()
    const savedTotal = result.current.currentPlannedNet

    act(() => {
      result.current.onChange(
        result.current.rows.map((row) => (row.id === 1 ? { ...row, clientPrice: 400 } : row)),
      )
    })
    expect(result.current.currentPlannedNet).toBe(450)

    await act(async () => {
      await result.current.flushPendingSaves()
    })

    expect(updateItemFieldAction).toHaveBeenCalledWith(1, { clientPrice: 400 })
    expect(result.current.rows.find((row) => row.id === 1)?.clientPrice).toBe(100)
    expect(result.current.currentPlannedNet).toBe(savedTotal)
    expect(toastMessage).toHaveBeenCalledWith('Zapis odrzucony', 'error', 5000)
  })
})
