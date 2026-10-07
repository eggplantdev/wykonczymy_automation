import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppLanguageProvider } from '@/components/i18n/app-language-provider'
import { ExpenseDraftDialog } from '@/components/worker-expenses/expense-draft-dialog'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'

// The worker's own page follows the account language (EX-996); a manager with no language set, or
// a surface outside the provider, keeps reading the Polish it always did.

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: vi.fn() }),
}))

const INVESTMENTS = [{ investmentId: 1, name: 'Mokotów' }] as WorkerStageInvestmentT[]
const REGISTERS = [{ id: 3, name: 'Kasa Jana', active: true }] as never

const dialog = <ExpenseDraftDialog investments={INVESTMENTS} registers={REGISTERS} />

describe('ExpenseDraftDialog language', () => {
  it('reads Ukrainian under a uk account', async () => {
    render(<AppLanguageProvider locale="uk">{dialog}</AppLanguageProvider>)

    await userEvent.click(screen.getByRole('button', { name: 'Витрата' }))

    expect(screen.getByRole('dialog', { name: 'Нова витрата' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Надіслати' })).toBeInTheDocument()
  })

  it('reads Polish without a provider', async () => {
    render(dialog)

    await userEvent.click(screen.getByRole('button', { name: 'Wydatek' }))

    expect(screen.getByRole('dialog', { name: 'Nowy wydatek' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeInTheDocument()
  })
})
