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
  wToolsAuto: false,
  wToolsRate: '65',
  ownToolsAuto: true,
  ownToolsRate: '',
}

const W_TOOLS_RATE = 'Stawka z narzędziami (PLN)'
const W_TOOLS_AUTO = 'Stawka z narzędziami: auto — ze współczynnika inwestycji'

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
  return {
    action,
    user,
    save: () => user.click(screen.getByRole('button', { name: 'Zapisz' })),
  }
}

beforeEach(() => vi.clearAllMocks())

// The kwota field UNMOUNTS when „auto" is ticked, and TanStack keeps the errors an unmounted field
// was left holding. So a „jest wymagana" raised by a failed submit outlives the field it belongs to:
// without the reset the form is unsaveable from then on, and the reason is invisible — the error
// hangs on an input nobody can see.
describe('WorkCatalogueItemForm — „auto" clears the kwota it hides', () => {
  it('saves after „auto" is ticked over a kwota that had just failed validation', async () => {
    const { action, user, save } = renderForm()

    await user.clear(screen.getByLabelText(W_TOOLS_RATE))
    await save()
    expect(await screen.findByText(/Stawka z narzędziami jest wymagana/)).toBeInTheDocument()

    await user.click(screen.getByLabelText(W_TOOLS_AUTO))
    await save()

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(action.mock.calls[0][0]).toMatchObject({ wToolsRate: null })
  })

  it('takes the kwota back off the payload the moment „auto" is ticked', async () => {
    const { action, user, save } = renderForm()

    await user.click(screen.getByLabelText(W_TOOLS_AUTO))
    expect(screen.queryByLabelText(W_TOOLS_RATE)).not.toBeInTheDocument()
    await save()

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(action.mock.calls[0][0]).toMatchObject({ wToolsRate: null })
  })

  it('still refuses a blank kwota while „auto" is off', async () => {
    const { action, user, save } = renderForm()

    await user.clear(screen.getByLabelText(W_TOOLS_RATE))
    await save()

    expect(await screen.findByText(/Stawka z narzędziami jest wymagana/)).toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
  })
})
