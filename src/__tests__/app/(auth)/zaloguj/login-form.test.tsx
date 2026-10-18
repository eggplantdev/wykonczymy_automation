import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '@/app/(auth)/zaloguj/login-form'
import { loginAction } from '@/lib/actions/auth'

describe('LoginForm — a request that never completed', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows the Polish message and hands the button back', async () => {
    vi.mocked(loginAction).mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'jan@example.test')
    await user.type(screen.getByLabelText('Hasło'), 'tajne-haslo')
    await user.click(screen.getByRole('button', { name: 'Zaloguj' }))

    expect(await screen.findByText(/Brak połączenia z serwerem/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zaloguj' })).toBeEnabled()
  })
})
