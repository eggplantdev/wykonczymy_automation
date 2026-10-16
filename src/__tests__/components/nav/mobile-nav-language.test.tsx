import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MobileNav } from '@/components/nav/mobile-nav'
import { I18nContext } from '@/hooks/use-translation'
import type { LanguageT } from '@/lib/i18n/languages'

vi.mock('next/navigation', () => ({ usePathname: () => '/pracownicy/7' }))
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: 7, email: 'jan@test.invalid', name: 'Jan', role: 'EMPLOYEE' }),
}))
vi.mock('@/hooks/use-nav-links', () => ({
  useNavLinks: () => ({ links: [], isActive: () => false }),
}))

const openDrawer = async (locale?: LanguageT) => {
  render(
    locale ? (
      <I18nContext.Provider value={{ locale, setLocale: () => {} }}>
        <MobileNav />
      </I18nContext.Provider>
    ) : (
      <MobileNav />
    ),
  )
  await userEvent.click(screen.getByRole('button', { name: locale === 'ru' ? 'Меню' : 'Menu' }))
}

describe('MobileNav language', () => {
  it('renders the drawer in Russian', async () => {
    await openDrawer('ru')

    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Обновить данные' })).toBeInTheDocument()
    expect(screen.getByText('Работник')).toBeInTheDocument()
    expect(screen.queryByText('Wyloguj')).not.toBeInTheDocument()
  })

  it('stays Polish without a provider', async () => {
    await openDrawer()

    expect(screen.getByRole('button', { name: 'Wyloguj' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Odśwież dane' })).toBeInTheDocument()
  })
})
