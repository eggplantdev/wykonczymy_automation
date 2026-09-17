import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RecipientListForm } from '@/components/forms/recipient-list-form/recipient-list-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

// The rule is enforced twice: the action refuses an empty array (tested), the form refuses to
// build one by disabling the last remove button. This covers that second half — nothing here for
// an E2E spec to submit.
function renderForm(emails: string[]) {
  const action = vi.fn(async (_emails: string[]) => ({ success: true as const }))
  render(
    <RecipientListForm
      formId="recipients-opsAlerts"
      emails={emails}
      action={action}
      onSubmitSuccess={vi.fn()}
    />,
  )
  return { action, user: userEvent.setup() }
}

const removeButtons = () => screen.getAllByRole('button', { name: 'Usuń odbiorcę' })

beforeEach(() => vi.clearAllMocks())

describe('RecipientListForm — the last recipient cannot be removed', () => {
  it('disables the remove button while one address is left', () => {
    renderForm(['jeden@wykonczymy.test'])

    expect(removeButtons()[0]).toBeDisabled()
  })

  it('re-disables it the moment a two-row list becomes a one-row list', async () => {
    const { user } = renderForm(['jeden@wykonczymy.test', 'dwa@wykonczymy.test'])
    expect(removeButtons()[0]).toBeEnabled()

    await user.click(removeButtons()[1])

    await waitFor(() => expect(removeButtons()).toHaveLength(1))
    expect(removeButtons()[0]).toBeDisabled()
  })

  it('submits the addresses trimmed', async () => {
    // Pasted addresses arrive with a trailing space often enough that storing one would mail nobody.
    const { action, user } = renderForm(['  jeden@wykonczymy.test  '])

    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(action.mock.calls[0][0]).toEqual(['jeden@wykonczymy.test'])
  })
})
