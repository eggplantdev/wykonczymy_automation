import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ActionResultT } from '@/types/action'

// ── Mocks ────────────────────────────────────────────────────────────────

const mockToastMessage = vi.fn()

vi.mock('@/lib/utils/toast', () => ({
  toastMessage: (...args: unknown[]) => mockToastMessage(...args),
}))

const { useOptimisticFormStore } = await import('@/stores/optimistic-form-store')
const { usePendingStore } = await import('@/stores/pending-store')

const store = () => useOptimisticFormStore.getState()
const pending = () => usePendingStore.getState().pending

beforeEach(() => {
  mockToastMessage.mockReset()
  // Reset store to initial state
  useOptimisticFormStore.setState({
    openFormId: null,
    submission: null,
    keepOpen: false,
    showKeepOpen: false,
  })
  usePendingStore.setState({ pending: new Map() })
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

  it('openDialog resets keepOpen and sets showKeepOpen (default true)', () => {
    store().setKeepOpen(true)
    store().openDialog('transfer')
    expect(store().keepOpen).toBe(false)
    expect(store().showKeepOpen).toBe(true)
  })

  it('openDialog with showKeepOpen=false hides the checkbox', () => {
    store().openDialog('editTransfer', false)
    expect(store().showKeepOpen).toBe(false)
  })

  it('a failed submit reopens without resetting keepOpen (choice preserved for retry)', () => {
    store().openDialog('transfer')
    store().setKeepOpen(true)
    // submitOptimistically reopens via a direct set, bypassing openDialog's reset
    useOptimisticFormStore.setState({ openFormId: 'transfer' })
    expect(store().keepOpen).toBe(true)
  })
})

// ── submitOptimistically ─────────────────────────────────────────────────

describe('submitOptimistically', () => {
  const files = new Map<number, File[]>()
  const onSuccess = vi.fn()

  beforeEach(() => {
    onSuccess.mockReset()
  })

  it('immediately closes dialog and sets pending submission', () => {
    store().openDialog('transfer')

    const action = vi.fn(() => new Promise<ActionResultT>(() => {})) // never resolves

    store().submitOptimistically('transfer', files, action, 'OK', onSuccess)

    expect(store().openFormId).toBeNull()
    expect(store().submission).toEqual({
      formId: 'transfer',
      invoiceFiles: files,
      status: 'pending',
      error: null,
    })
  })

  it('on success: clears submission, calls onSuccess, and shows toast', async () => {
    const action = vi.fn(() => Promise.resolve({ success: true } as ActionResultT))

    store().submitOptimistically('deposit', files, action, 'Wpłata dodana', onSuccess)

    // Wait for the async action to resolve
    await vi.waitFor(() => {
      expect(store().submission).toBeNull()
    })

    expect(store().openFormId).toBeNull()
    expect(onSuccess).toHaveBeenCalledOnce()
    expect(mockToastMessage).toHaveBeenCalledWith('Wpłata dodana', 'success', 1000)
  })

  it('on failure: reopens dialog, sets failed status, shows error toast', async () => {
    const action = vi.fn(() =>
      Promise.resolve({ success: false, error: 'Niewystarczające saldo' } as ActionResultT),
    )

    store().submitOptimistically('transfer', files, action, 'OK', onSuccess)

    await vi.waitFor(() => {
      expect(store().submission?.status).toBe('failed')
    })

    expect(store().openFormId).toBe('transfer')
    expect(store().submission).toEqual({
      formId: 'transfer',
      invoiceFiles: files,
      status: 'failed',
      error: 'Niewystarczające saldo',
    })
    expect(onSuccess).not.toHaveBeenCalled()
    expect(mockToastMessage).toHaveBeenCalledWith('Niewystarczające saldo', 'error', 5000)
  })

  it('preserves every page of a row’s invoice in submission for recovery', async () => {
    const page1 = new File(['data'], 'invoice.pdf', { type: 'application/pdf' })
    const page2 = new File(['more'], 'invoice-2.pdf', { type: 'application/pdf' })
    const filesWithInvoice = new Map([[0, [page1, page2]]])

    const action = vi.fn(() => Promise.resolve({ success: false, error: 'fail' } as ActionResultT))

    store().submitOptimistically('transfer', filesWithInvoice, action, 'OK', onSuccess)

    await vi.waitFor(() => {
      expect(store().submission?.status).toBe('failed')
    })

    expect(store().submission?.invoiceFiles.get(0)).toEqual([page1, page2])
  })
})

// ── The global pill ──────────────────────────────────────────────────────

// The indicator reads only the pending store, so an optimistic submit that fails to release its key
// leaves a pill on screen with no dialog to explain it — every settle path must clear it.
describe('submitOptimistically raises the global pill', () => {
  const files = new Map<number, File[]>()

  it('holds the key, keyed on formId, while the action is in flight', () => {
    store().submitOptimistically(
      'transfer',
      files,
      vi.fn(() => new Promise<ActionResultT>(() => {})),
      'OK',
      vi.fn(),
    )

    expect(pending().get('transfer')).toBe('Zapisywanie…')
  })

  it('releases the key on success', async () => {
    store().submitOptimistically(
      'transfer',
      files,
      vi.fn(() => Promise.resolve({ success: true } as ActionResultT)),
      'OK',
      vi.fn(),
    )

    await vi.waitFor(() => expect(pending().size).toBe(0))
  })

  it('releases the key when the action returns a failure', async () => {
    store().submitOptimistically(
      'transfer',
      files,
      vi.fn(() => Promise.resolve({ success: false, error: 'nie' } as ActionResultT)),
      'OK',
      vi.fn(),
    )

    await vi.waitFor(() => expect(pending().size).toBe(0))
  })

  it('releases the key when the action rejects', async () => {
    store().submitOptimistically(
      'transfer',
      files,
      vi.fn(() => Promise.reject(new Error('boom'))),
      'OK',
      vi.fn(),
    )

    await vi.waitFor(() => expect(pending().size).toBe(0))
  })

  it('reports a failed request in Polish, not the browser message', async () => {
    store().submitOptimistically(
      'transfer',
      files,
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
      'OK',
      vi.fn(),
    )

    await vi.waitFor(() => expect(store().submission?.status).toBe('failed'))
    expect(store().submission?.error).toMatch(/^Brak połączenia z serwerem/)
    expect(mockToastMessage).toHaveBeenCalledWith(
      expect.stringMatching(/^Brak połączenia z serwerem/),
      'error',
      5000,
    )
  })

  it('a second save in flight keeps its own key alive when the first settles', async () => {
    store().submitOptimistically(
      'transfer',
      files,
      vi.fn(() => Promise.resolve({ success: true } as ActionResultT)),
      'OK',
      vi.fn(),
    )
    store().submitOptimistically(
      'deposit',
      files,
      vi.fn(() => new Promise<ActionResultT>(() => {})),
      'OK',
      vi.fn(),
    )

    await vi.waitFor(() => expect(pending().has('transfer')).toBe(false))
    expect(pending().get('deposit')).toBe('Zapisywanie…')
  })
})

// ── clearSubmission ──────────────────────────────────────────────────────

describe('clearSubmission', () => {
  it('clears submission without affecting dialog state', () => {
    store().openDialog('transfer')
    useOptimisticFormStore.setState({
      submission: {
        formId: 'transfer',
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
