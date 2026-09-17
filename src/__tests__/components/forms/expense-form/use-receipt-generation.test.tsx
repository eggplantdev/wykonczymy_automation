import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useReceiptGeneration } from '@/components/forms/expense-form/use-receipt-generation'
import type { BulkExpenseFormApiT } from '@/components/forms/expense-form/bulk-expense-form'
import type { ReceiptFillResultT } from '@/lib/ai/scan-receipt'
import { scanReceiptClient } from '@/lib/utils/scan-receipt-client'
import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { usePendingStore } from '@/stores/pending-store'

vi.mock('@/lib/utils/scan-receipt-client', () => ({ scanReceiptClient: vi.fn() }))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/utils/log-error', () => ({ logError: vi.fn() }))

// Kept real by default and only forced to reject in the escape test — that is the whole shape of
// the bug: `mapWithConcurrency` propagates, so anything torn down outside the `finally` is skipped.
vi.mock('@/lib/utils/map-with-concurrency', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/map-with-concurrency')>()
  return { mapWithConcurrency: vi.fn(actual.mapWithConcurrency) }
})

const ROWS = [
  { id: 'row-a', description: '', amount: '' },
  { id: 'row-b', description: '', amount: '' },
]

function renderGeneration() {
  const setFieldValue = vi.fn()
  const form = {
    getFieldValue: () => ROWS,
    setFieldValue,
  } as unknown as BulkExpenseFormApiT
  const files = new Map(ROWS.map((row) => [row.id, [new File(['x'], 'p.jpg')]]))

  const view = renderHook(() =>
    useReceiptGeneration({
      form,
      otherCategories: [],
      getFiles: () => files,
      renameFile: vi.fn(),
    }),
  )
  return { ...view, setFieldValue }
}

function scanned(overrides: Partial<ReceiptFillResultT> = {}): ReceiptFillResultT {
  return {
    description: 'Farba',
    amount: 120,
    netAmount: 97.56,
    invoiceNote: '',
    ...overrides,
  } as ReceiptFillResultT
}

beforeEach(() => {
  vi.clearAllMocks()
  usePendingStore.setState({ pending: new Map() })
})

describe('useReceiptGeneration — the form is released whatever the scan does', () => {
  it('releases the form and marks the row when a single receipt fails to read', async () => {
    vi.mocked(scanReceiptClient)
      .mockResolvedValueOnce(scanned())
      .mockRejectedValueOnce(new Error('502 z providera'))
    const { result } = renderGeneration()

    await act(async () => {
      await result.current.generateFromReceipts()
    })

    expect(result.current.isGenerating).toBe(false)
    expect(result.current.generationProgress).toBeNull()
    expect([...result.current.failedIds]).toEqual(['row-b'])
    expect(result.current.generatingIds.size).toBe(0)
    expect(usePendingStore.getState().pending.size).toBe(0)
  })

  it('releases the form when the scan itself is aborted', async () => {
    // Ships-broken path: the teardown sat after the await, so an escaping rejection left
    // `isGenerating` stuck true — buttons disabled and the pending pill stuck until unmount.
    vi.mocked(mapWithConcurrency).mockRejectedValueOnce(new Error('chunk load failed'))
    const { result } = renderGeneration()

    await act(async () => {
      await result.current.generateFromReceipts()
    })

    expect(result.current.isGenerating).toBe(false)
    expect(result.current.generationProgress).toBeNull()
    expect(usePendingStore.getState().pending.size).toBe(0)
  })

  it('does not let the aborted scan escape as an unhandled rejection', async () => {
    const unhandled = vi.fn()
    window.addEventListener('unhandledrejection', unhandled)
    vi.mocked(mapWithConcurrency).mockRejectedValueOnce(new Error('chunk load failed'))
    const { result } = renderGeneration()

    await act(async () => {
      await expect(result.current.generateFromReceipts()).resolves.toBeUndefined()
    })

    expect(unhandled).not.toHaveBeenCalled()
    window.removeEventListener('unhandledrejection', unhandled)
  })

  it('holds the pending pill up for as long as the scan runs', async () => {
    let release!: (data: ReceiptFillResultT) => void
    vi.mocked(scanReceiptClient).mockReturnValue(
      new Promise<ReceiptFillResultT>((resolve) => (release = resolve)),
    )
    const { result } = renderGeneration()

    let finished!: Promise<void>
    act(() => {
      finished = result.current.generateFromReceipts()
    })
    await waitFor(() => expect(result.current.isGenerating).toBe(true))
    expect(usePendingStore.getState().pending.size).toBe(1)

    await act(async () => {
      release(scanned())
      await finished
    })

    expect(result.current.isGenerating).toBe(false)
    expect(usePendingStore.getState().pending.size).toBe(0)
  })

  it('skips a row that is already filled in by hand', async () => {
    const { result, setFieldValue } = renderGeneration()
    ROWS[0].description = 'Wpisane ręcznie'
    vi.mocked(scanReceiptClient).mockResolvedValue(scanned())

    await act(async () => {
      await result.current.generateFromReceipts()
    })
    ROWS[0].description = ''

    expect(scanReceiptClient).toHaveBeenCalledTimes(1)
    expect(setFieldValue).toHaveBeenCalledWith('lineItems[1].description', 'Farba')
  })
})
