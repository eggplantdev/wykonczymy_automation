import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppLanguageProvider } from '@/components/i18n/app-language-provider'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const dialog = <ConfirmDialog open title="Usunąć?" onConfirm={vi.fn()} onCancel={vi.fn()} />

describe('ConfirmDialog cancel label', () => {
  it('reads the account language', () => {
    render(<AppLanguageProvider locale="uk">{dialog}</AppLanguageProvider>)

    expect(screen.getByRole('button', { name: 'Скасувати' })).toBeInTheDocument()
  })

  it('reads Polish without a provider', () => {
    render(dialog)

    expect(screen.getByRole('button', { name: 'Anuluj' })).toBeInTheDocument()
  })
})
