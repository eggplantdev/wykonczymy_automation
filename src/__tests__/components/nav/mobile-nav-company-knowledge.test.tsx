import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MobileNav } from '@/components/nav/mobile-nav'
import { fetchCompanyKnowledge } from '@/lib/queries/company-knowledge'
import { navigationState } from '@/__tests__/stubs/next-navigation'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'

navigationState.pathname = '/inwestycje'

vi.mock('@/hooks/use-current-user', () => import('@/__tests__/stubs/use-current-user'))
vi.mock('@/hooks/use-nav-links', () => ({
  useNavLinks: () => ({ links: [], isActive: () => false }),
}))

authState.role = 'MANAGER'
vi.mocked(fetchCompanyKnowledge).mockResolvedValue({
  success: true,
  data: [
    { id: 1, topic: 'Bruzdy wod-kan', content: 'Łazienka: ok. 2 mb.', updatedAt: '2026-10-08' },
  ],
})

describe('MobileNav → Manual Wykończymy', () => {
  it('keeps the book open after the drawer closes', async () => {
    const user = userEvent.setup()
    render(<MobileNav />)
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await user.click(screen.getByRole('button', { name: 'Manual Wykończymy' }))

    const book = await screen.findByRole('dialog', { name: 'Manual Wykończymy' })
    expect(await within(book).findByText('Bruzdy wod-kan')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Wyloguj' })).not.toBeInTheDocument()
  })
})
