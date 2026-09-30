import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '@/app/(auth)/zaloguj/login-form'

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))

const loginAction = vi.fn()
vi.mock('@/lib/actions/auth', () => ({
  loginAction: (...args: unknown[]) => loginAction(...args),
}))

describe('LoginForm — a request that never completed (EX-940)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows the Polish message and hands the button back', async () => {
    loginAction.mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'jan@example.test')
    await user.type(screen.getByLabelText('Hasło'), 'tajne-haslo')
    await user.click(screen.getByRole('button', { name: 'Zaloguj' }))

    expect(await screen.findByText(/Brak połączenia z serwerem/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zaloguj' })).toBeEnabled()
  })
})
