import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { createFormStore } from '@/stores/create-form-store'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

type ValuesT = { name: string }

const useTestFormStore = createFormStore<ValuesT>('use-managed-form-test')

function renderManagedForm(persistDraft: boolean) {
  const onSubmitSuccess = vi.fn()
  const hook = renderHook(() =>
    useManagedForm<ValuesT, ValuesT>({
      formId: 'edit-vehicle-1',
      useFormStore: useTestFormStore,
      schema: z.object({ name: z.string() }),
      defaultValues: { name: 'Stara nazwa' },
      successMessage: 'Zapisano',
      onSubmitSuccess,
      toData: (values) => values,
      action: async () => ({ success: false, error: 'Nie udało się zapisać' }),
      persistDraft,
    }),
  )
  return { ...hook, onSubmitSuccess }
}

beforeEach(() => vi.clearAllMocks())

// EX-942: an edit form keeps no draft, so the open dialog is the only place the typed values live.
describe('useManagedForm — a failed save on a form without a draft', () => {
  it('keeps the dialog open with the typed values', async () => {
    const { result, onSubmitSuccess } = renderManagedForm(false)

    act(() => result.current.form.setFieldValue('name', 'Nowa nazwa'))
    await act(() => result.current.form.handleSubmit())

    expect(onSubmitSuccess).not.toHaveBeenCalled()
    expect(result.current.form.state.values.name).toBe('Nowa nazwa')
  })
})

describe('useManagedForm — beforeSubmit', () => {
  it('sends nothing and keeps the values when it answers false', async () => {
    const action = vi.fn(async () => ({ success: true as const }))
    const onSubmitSuccess = vi.fn()
    const { result } = renderHook(() =>
      useManagedForm<ValuesT, ValuesT>({
        formId: 'before-submit-test',
        useFormStore: useTestFormStore,
        schema: z.object({ name: z.string() }),
        defaultValues: { name: '' },
        successMessage: 'Zapisano',
        onSubmitSuccess,
        toData: (values) => values,
        action,
        persistDraft: false,
        beforeSubmit: async () => false,
      }),
    )

    act(() => result.current.form.setFieldValue('name', 'Wpisana'))
    await act(() => result.current.form.handleSubmit())

    expect(action).not.toHaveBeenCalled()
    expect(onSubmitSuccess).not.toHaveBeenCalled()
    expect(result.current.form.state.values.name).toBe('Wpisana')
  })
})

describe('useManagedForm — keepAfterSave', () => {
  type DatedT = { name: string; date: string }

  function renderDated(keepOpen: boolean) {
    return renderHook(() =>
      useManagedForm<DatedT, DatedT>({
        formId: 'keep-after-save-test',
        useFormStore: createFormStore<DatedT>('keep-after-save-test'),
        schema: z.object({ name: z.string(), date: z.string() }),
        defaultValues: { name: '', date: '2026-10-05' },
        keepOpen,
        keepAfterSave: ['date'],
        successMessage: 'Zapisano',
        onSubmitSuccess: vi.fn(),
        toData: (values) => values,
        action: async () => ({ success: true as const }),
      }),
    )
  }

  async function saveDated(result: ReturnType<typeof renderDated>['result']) {
    act(() => {
      result.current.form.setFieldValue('name', 'Wpisana')
      result.current.form.setFieldValue('date', '2026-09-30')
    })
    await act(() => result.current.form.handleSubmit())
  }

  it('carries the date into the next entry on a „Nie zamykaj" save', async () => {
    const { result } = renderDated(true)
    await saveDated(result)

    expect(result.current.form.state.values).toEqual({ name: '', date: '2026-09-30' })
  })

  it('clears it like any other field when the dialog closes', async () => {
    const { result } = renderDated(false)
    await saveDated(result)

    expect(result.current.form.state.values).toEqual({ name: '', date: '2026-10-05' })
  })
})
