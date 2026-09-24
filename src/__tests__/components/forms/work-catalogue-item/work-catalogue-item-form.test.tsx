import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkCatalogueItemForm } from '@/components/forms/work-catalogue-item/work-catalogue-item-form'
import type {
  WorkCatalogueItemDataT,
  WorkCatalogueItemFormValuesT,
} from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const ITEM: WorkCatalogueItemFormValuesT = {
  description: 'Malowanie ścian',
  category: 'Wykończenia',
  unit: 'm2',
  clientPrice: '100',
  wToolsSource: 'amount',
  wToolsRate: '65',
  wToolsCoeff: '',
  ownToolsSource: 'auto',
  ownToolsRate: '',
  ownToolsCoeff: '',
}

const W_TOOLS_RATE = 'Stawka z narzędziami (podwykonawca) (PLN)'
const W_TOOLS_COEFF = 'Mnożnik — stawka z narzędziami (podwykonawca)'
const W_TOOLS_SOURCE = /Stawka z narzędziami \(podwykonawca\) — źródło/

function renderForm() {
  const action = vi.fn(async (_values: WorkCatalogueItemDataT) => ({
    success: true as const,
  }))
  render(
    <WorkCatalogueItemForm
      formId="edit-catalogue-item-1"
      defaultValues={ITEM}
      categorySuggestions={['Wykończenia']}
      action={action}
      successMessage="Pozycja zaktualizowana"
      submitLabel="Zapisz"
      submittingLabel="Zapisywanie..."
      onSubmitSuccess={vi.fn()}
      persistDraft={false}
    />,
  )
  const user = userEvent.setup()
  const pickSource = async (option: RegExp) => {
    await user.click(screen.getByRole('combobox', { name: W_TOOLS_SOURCE }))
    await user.click(await screen.findByRole('option', { name: option }))
  }
  return {
    action,
    user,
    pickSource,
    save: () => user.click(screen.getByRole('button', { name: 'Zapisz' })),
  }
}

beforeEach(() => vi.clearAllMocks())

// The input under a źródło unmounts when another one is picked, but TanStack keeps the error it was
// holding — without a reset on unmount, a prior „jest wymagana" makes the form unsaveable with no
// visible input to blame.
describe('WorkCatalogueItemForm — źródło stawki', () => {
  it('saves after „auto" is picked over a kwota that had just failed validation', async () => {
    const { action, pickSource, user, save } = renderForm()

    await user.clear(screen.getByLabelText(W_TOOLS_RATE))
    await save()
    expect(
      await screen.findByText(/Stawka z narzędziami \(podwykonawca\) jest wymagana/),
    ).toBeInTheDocument()

    await pickSource(/^auto/)
    await save()

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(action.mock.calls[0][0]).toMatchObject({ wToolsRate: null, wToolsRateCoeff: null })
  })

  it('takes the kwota back off the payload the moment „auto" is picked', async () => {
    const { action, pickSource, save } = renderForm()

    await pickSource(/^auto/)
    expect(screen.queryByLabelText(W_TOOLS_RATE)).not.toBeInTheDocument()
    await save()

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(action.mock.calls[0][0]).toMatchObject({ wToolsRate: null, wToolsRateCoeff: null })
  })

  // The whole point of the trzecie źródło: what lands in the katalog is the KROTNOŚĆ, not the kwota
  // it happens to come out to at today's cena j.m.
  it('zapisuje mnożnik w jego własnej kolumnie, a kwotę zeruje', async () => {
    const { action, pickSource, user, save } = renderForm()

    await pickSource(/własny mnożnik/)
    expect(screen.queryByLabelText(W_TOOLS_RATE)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(W_TOOLS_COEFF), '0,65')
    await save()

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(action.mock.calls[0][0]).toMatchObject({ wToolsRate: null, wToolsRateCoeff: 0.65 })
  })

  it('pusty mnożnik jest odrzucany zdaniem o mnożniku, nie o stawce', async () => {
    const { action, pickSource, save } = renderForm()

    await pickSource(/własny mnożnik/)
    await save()

    expect(
      await screen.findByText(/Mnożnik \(Stawka z narzędziami \(podwykonawca\)\) jest wymagany/),
    ).toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
  })

  it('still refuses a blank kwota while „kwota stała" is picked', async () => {
    const { action, user, save } = renderForm()

    await user.clear(screen.getByLabelText(W_TOOLS_RATE))
    await save()

    expect(
      await screen.findByText(/Stawka z narzędziami \(podwykonawca\) jest wymagana/),
    ).toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
  })
})
