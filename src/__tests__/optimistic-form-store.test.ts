import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ActionResultT } from '@/lib/actions/utils'

// ── Mocks ────────────────────────────────────────────────────────────────

const mockToastMessage = vi.fn()

vi.mock('@/components/toasts', () => ({
  toastMessage: (...args: unknown[]) => mockToastMessage(...args),
}))

const { useOptimisticFormStore } = await import('@/stores/optimistic-form-store')

const store = () => useOptimisticFormStore.getState()

beforeEach(() => {
  mockToastMessage.mockReset()
  // Reset store to initial state
  useOptimisticFormStore.setState({ openFormId: null, submission: null })
})

// ── Dialog state ─────────────────────────────────────────────────────────

describe('dialog state', () => {
  it('openDialog sets openFormId', () => {
    store().openDialog('transfer')
    expect(store().openFormId).toBe('transfer')
  })

  it('closeDialog clears openFormId', () => {
    store().openDialog('transfer')
    store().closeDialog()
    expect(store().openFormId).toBeNull()
  })

  it('opening a different dialog replaces the previous one', () => {
    store().openDialog('transfer')
    store().openDialog('deposit')
    expect(store().openFormId).toBe('deposit')
  })
})

// ── submitOptimistically ─────────────────────────────────────────────────

describe('submitOptimistically', () => {
  const formValues = { amount: '100', description: 'test' }
  const files = new Map<number, File>()

  it('immediately closes dialog and sets pending submission', () => {
    store().openDialog('transfer')

    const action = vi.fn(() => new Promise<ActionResultT>(() => {})) // never resolves

    store().submitOptimistically('transfer', formValues, files, action, 'OK')

    expect(store().openFormId).toBeNull()
    expect(store().submission).toEqual({
      formId: 'transfer',
      formValues,
      invoiceFiles: files,
      status: 'pending',
      error: null,
    })
  })

  it('on success: clears submission and shows success toast', async () => {
    const action = vi.fn(() => Promise.resolve({ success: true } as ActionResultT))

    store().submitOptimistically('deposit', formValues, files, action, 'Wpłata dodana')

    // Wait for the async action to resolve
    await vi.waitFor(() => {
      expect(store().submission).toBeNull()
    })

    expect(store().openFormId).toBeNull()
    expect(mockToastMessage).toHaveBeenCalledWith('Wpłata dodana', 'success')
  })

  it('on failure: reopens dialog, sets failed status, shows error toast', async () => {
    const action = vi.fn(() =>
      Promise.resolve({ success: false, error: 'Niewystarczające saldo' } as ActionResultT),
    )

    store().submitOptimistically('transfer', formValues, files, action, 'OK')

    await vi.waitFor(() => {
      expect(store().submission?.status).toBe('failed')
    })

    expect(store().openFormId).toBe('transfer')
    expect(store().submission).toEqual({
      formId: 'transfer',
      formValues,
      invoiceFiles: files,
      status: 'failed',
      error: 'Niewystarczające saldo',
    })
    expect(mockToastMessage).toHaveBeenCalledWith('Niewystarczające saldo', 'error')
  })

  it('preserves invoice files in submission for recovery', async () => {
    const file = new File(['data'], 'invoice.pdf', { type: 'application/pdf' })
    const filesWithInvoice = new Map([[0, file]])

    const action = vi.fn(() => Promise.resolve({ success: false, error: 'fail' } as ActionResultT))

    store().submitOptimistically('settlement', formValues, filesWithInvoice, action, 'OK')

    await vi.waitFor(() => {
      expect(store().submission?.status).toBe('failed')
    })

    expect(store().submission?.invoiceFiles.get(0)).toBe(file)
  })
})

// ── clearSubmission ──────────────────────────────────────────────────────

describe('clearSubmission', () => {
  it('clears submission without affecting dialog state', () => {
    store().openDialog('transfer')
    useOptimisticFormStore.setState({
      submission: {
        formId: 'transfer',
        formValues: {},
        invoiceFiles: new Map(),
        status: 'failed',
        error: 'err',
      },
    })

    store().clearSubmission()

    expect(store().submission).toBeNull()
    expect(store().openFormId).toBe('transfer')
  })
})
