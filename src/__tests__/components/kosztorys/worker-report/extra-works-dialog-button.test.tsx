import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExtraWorksDialogButton } from '@/components/kosztorys/worker-report/extra-works-dialog-button'
import type { ExtraWorkT } from '@/components/kosztorys/worker-report/types'
import { ru } from '@/lib/i18n/dictionaries/ru'
import { uk } from '@/lib/i18n/dictionaries/uk'
import { TranslationsProvider } from '@/components/kosztorys/worker-report/translations-provider'

function Harness({ onSaved }: { onSaved?: (extra: ExtraWorkT) => void }) {
  const [extras, setExtras] = useState<ExtraWorkT[]>([])
  return (
    <ExtraWorksDialogButton
      extras={extras}
      commonUnits={['m2']}
      onSave={(extra) => {
        onSaved?.(extra)
        setExtras((current) =>
          current.some((each) => each.key === extra.key)
            ? current.map((each) => (each.key === extra.key ? extra : each))
            : [...current, extra],
        )
      }}
      onRemove={(key) => setExtras((current) => current.filter((each) => each.key !== key))}
    />
  )
}

describe('ExtraWorksDialogButton', () => {
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

  it.each([
    ['uk', uk],
    ['ru', ru],
  ] as const)('speaks %s to a worker who chose it', async (locale, dictionary) => {
    render(
      <TranslationsProvider initialLocale={locale} workerId={1}>
        <Harness />
      </TranslationsProvider>,
    )
    const copy = dictionary.report
    await userEvent.click(screen.getByRole('button', { name: new RegExp(copy.newWork) }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: copy.descriptionPlaceholder }),
      'Монтаж',
    )

    await userEvent.click(within(dialog).getByRole('button', { name: copy.done }))

    expect(within(dialog).getByText(copy.extrasFixErrors)).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: copy.reportColumn })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(within(dialog).queryByText(/Popraw błędy/)).not.toBeInTheDocument()
  })

  it('lists j.m. in the worker’s language but saves the Polish unit', async () => {
    const onSaved = vi.fn()
    render(
      <TranslationsProvider initialLocale="uk" workerId={1}>
        <Harness onSaved={onSaved} />
      </TranslationsProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: new RegExp(uk.report.newWork) }))
    const dialog = screen.getByRole('dialog')

    await userEvent.click(within(dialog).getByRole('combobox'))
    expect(screen.getByRole('option', { name: 'м²' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: 'пог. м' }))

    expect(onSaved).toHaveBeenLastCalledWith(expect.objectContaining({ unit: 'mb' }))
  })
})
