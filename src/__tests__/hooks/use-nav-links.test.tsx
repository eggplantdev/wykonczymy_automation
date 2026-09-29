import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CurrentUserProvider } from '@/hooks/use-current-user'
import { useNavLinks } from '@/hooks/use-nav-links'
import type { RoleT } from '@/lib/auth/roles'
import type { SessionUserT } from '@/types/auth'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

const hrefsFor = (role: RoleT) => {
  const user = { id: 1, role, name: 'T', email: 't@t.pl' } as SessionUserT
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CurrentUserProvider user={user}>{children}</CurrentUserProvider>
  )
  return renderHook(() => useNavLinks(), { wrapper }).result.current.links.map((link) => link.href)
}

describe('useNavLinks', () => {
  it.each<RoleT>(['OWNER', 'ADMIN', 'MANAGER'])('puts „Kosz" last for %s', (role) => {
    expect(hrefsFor(role).at(-1)).toBe('/kosz')
  })

  it.each<RoleT>(['EMPLOYEE'])('hides „Kosz" from %s', (role) => {
    expect(hrefsFor(role)).not.toContain('/kosz')
  })

  it('offers EMPLOYEE only „Transakcje" — every other route redirects the role back to „/"', () => {
    expect(hrefsFor('EMPLOYEE')).toEqual(['/'])
  })
})
