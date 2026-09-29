import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useKosztorysSettings } from '@/components/kosztorys/editor/hooks/use-kosztorys-settings'
import type { KosztorysTreeT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import type { ActionResultT } from '@/types/action'
import {
  updateInvestmentGlobalDiscountAction,
  updateInvestmentMaterialsNetRateAction,
  updateInvestmentVatAction,
} from '@/lib/actions/kosztorys'
import { discountNetFromGross } from '@/lib/kosztorys/calc'
import { usePendingStore } from '@/stores/pending-store'

vi.mock('@/lib/actions/kosztorys', () => ({
  applyPercentDiscountToAllItemsAction: vi.fn(),
  updateInvestmentCoeffsAction: vi.fn(),
  updateInvestmentGlobalDiscountAction: vi.fn(),
  updateInvestmentMaterialsNetRateAction: vi.fn(),
  updateInvestmentSettlementModeAction: vi.fn(),
  updateInvestmentVatAction: vi.fn(),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const TREE = {
  globalDiscount: { percent: 0, amount: 0 },
  vatRate: 0.23,
  settlementMode: 'net',
  materialsNetRate: 0.9,
} as unknown as KosztorysTreeT

// A pending write that the test decides when to land — the risk here is two of them overlapping.
function deferred() {
  let settle!: (result: ActionResultT) => void
  const promise = new Promise<ActionResultT>((resolve) => (settle = resolve))
  return { promise, settle }
}

function renderSettings(tree: KosztorysTreeT = TREE) {
  const rowsRef = { current: [{ vatRate: 0.23 }] as unknown as KosztorysV2RowT[] }
  return renderHook(() =>
    useKosztorysSettings({
      investmentId: 1,
      tree,
      rowsRef,
      patchRows: vi.fn(),
      pushReversible: vi.fn(),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  usePendingStore.setState({ pending: new Map() })
})

describe('useKosztorysSettings — two „Opcje rozliczenia" saves in flight at once', () => {
  it('keeps the pill up until the second save lands, not the first', async () => {
    const vat = deferred()
    const rate = deferred()
    vi.mocked(updateInvestmentVatAction).mockReturnValue(vat.promise)
    vi.mocked(updateInvestmentMaterialsNetRateAction).mockReturnValue(rate.promise)
    const { result } = renderSettings()

    act(() => {
      result.current.handleVatChange(0.08)
      result.current.handleMaterialsNetRateChange(0.8)
    })

    // Two saves, two keys. One shared key is the bug: the first `finally` would delete the entry the
    // second write is still holding, and the pill would vanish mid-save.
    await waitFor(() => expect(usePendingStore.getState().pending.size).toBe(2))
    expect(result.current.isSavingSettings).toBe(true)

    await act(async () => {
      vat.settle({ success: true } as ActionResultT)
      await vat.promise
    })

    expect(usePendingStore.getState().pending.size).toBe(1)
    expect(result.current.isSavingSettings).toBe(true)

    await act(async () => {
      rate.settle({ success: true } as ActionResultT)
      await rate.promise
    })

    await waitFor(() => expect(usePendingStore.getState().pending.size).toBe(0))
    expect(result.current.isSavingSettings).toBe(false)
  })

  it('releases its key when a save fails', async () => {
    vi.mocked(updateInvestmentVatAction).mockResolvedValue({
      success: false,
      error: 'Brak uprawnień',
    } as ActionResultT)
    const { result } = renderSettings()

    await act(async () => {
      result.current.handleVatChange(0.08)
    })

    await waitFor(() => expect(result.current.isSavingSettings).toBe(false))
    expect(usePendingStore.getState().pending.size).toBe(0)
  })

  it('releases its key when the action throws outright', async () => {
    vi.mocked(updateInvestmentVatAction).mockRejectedValue(new Error('połączenie zerwane'))
    const { result } = renderSettings()

    await act(async () => {
      result.current.handleVatChange(0.08)
    })

    await waitFor(() => expect(result.current.isSavingSettings).toBe(false))
    expect(usePendingStore.getState().pending.size).toBe(0)
  })

  it('does not ask about the investor when the stawka is corrected inside the same tryb', async () => {
    vi.mocked(updateInvestmentMaterialsNetRateAction).mockResolvedValue({
      success: true,
    } as ActionResultT)
    const { result } = renderSettings()

    await act(async () => {
      result.current.handleMaterialsNetRateChange(0.8)
    })

    expect(result.current.investorImpactConfirm.open).toBe(false)
    expect(updateInvestmentMaterialsNetRateAction).toHaveBeenCalledWith(1, 0.8)
  })

  it('asks about the investor before switching the tryb to brutto', async () => {
    const { result } = renderSettings()

    act(() => {
      result.current.handleMaterialsNetRateChange(null)
    })

    expect(result.current.investorImpactConfirm.open).toBe(true)
    expect(updateInvestmentMaterialsNetRateAction).not.toHaveBeenCalled()
  })
})

describe('useKosztorysSettings — rabat kwotowy', () => {
  // EX-933: cut to grosze, some brutto entries re-gross a grosz off what was typed.
  it('stores a kwota typed in brutto at six places, not grosze', async () => {
    vi.mocked(updateInvestmentGlobalDiscountAction).mockResolvedValue({
      success: true,
    } as ActionResultT)
    const { result } = renderSettings({
      ...TREE,
      globalDiscount: { type: 'amount', value: 0 },
    } as KosztorysTreeT)

    await act(async () => {
      result.current.handleGlobalDiscountChange({ type: 'amount', value: discountNetFromGross(5000, 0.08) })
    })

    expect(updateInvestmentGlobalDiscountAction).toHaveBeenCalledWith(1, {
      globalDiscountType: 'amount',
      globalDiscountValue: 4629.62963,
    })
  })
})
