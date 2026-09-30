import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExtraWorksDialogButton } from '@/components/kosztorys/worker-report/extra-works-dialog-button'
import type { ExtraWorkT } from '@/components/kosztorys/worker-report/types'

function Harness() {
  const [extras, setExtras] = useState<ExtraWorkT[]>([])
  return (
    <ExtraWorksDialogButton
      extras={extras}
      commonUnits={['m2']}
      onSave={(extra) =>
        setExtras((current) =>
          current.some((each) => each.key === extra.key)
            ? current.map((each) => (each.key === extra.key ? extra : each))
            : [...current, extra],
        )
      }
      onRemove={(key) => setExtras((current) => current.filter((each) => each.key !== key))}
    />
  )
}

describe('ExtraWorksDialogButton', () => {
  // A half-filled row behind a closed dialog surfaced only as a blocked „Wyślij” with a wrong reason.
  it('refuses to close on a half-filled row and says what is missing', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: /Nowa praca/ }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Opis prac' }), 'Montaż')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Gotowe' }))
    await userEvent.keyboard('{Escape}')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialog).getByText(/Popraw błędy/)).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Zgłaszam' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('closes once the half-filled row is removed', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: /Nowa praca/ }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Opis prac' }), 'Montaż')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Usuń pracę' }))

    await userEvent.click(within(dialog).getByRole('button', { name: 'Gotowe' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
