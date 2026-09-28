import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { Sidebar } from '@/components/nav/sidebar'

vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: 1, email: 'o@example.test', name: 'Testowy', role: 'OWNER' }),
}))
vi.mock('@/hooks/use-nav-links', () => ({
  useNavLinks: () => ({
    links: [{ href: '/przelewy', label: 'Przelewy', icon: Home }],
    isActive: () => false,
  }),
}))
vi.mock('@/hooks/use-sidebar-collapsed', () => ({ useSidebarCollapsed: () => [true, vi.fn()] }))

// Collapsed, the icon is all that is left of each control; the tooltip is its name.
describe('Sidebar — collapsed', () => {
  it('names the collapse handle on hover', async () => {
    render(<Sidebar />)
    await userEvent.hover(screen.getByRole('button', { name: 'Rozwiń menu' }))

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Rozwiń menu')
  })

  it.each([
    // Collapsed, the nav link has no text left to be named by.
    ['Przelewy', () => document.querySelector<HTMLElement>('a[href="/przelewy"]')!],
    ['Przełącz motyw', () => screen.getByRole('button', { name: 'Przełącz motyw' })],
    ['Odśwież dane', () => screen.getByRole('button', { name: 'Odśwież dane' })],
    ['Admin', () => screen.getByRole('link', { name: 'Panel administracyjny' })],
    ['Wyloguj', () => screen.getByRole('button', { name: 'Wyloguj' })],
  ])('names „%s" on hover', async (label, control) => {
    render(<Sidebar />)
    await userEvent.hover(control())

    expect(await screen.findByRole('tooltip')).toHaveTextContent(label)
  })
})
