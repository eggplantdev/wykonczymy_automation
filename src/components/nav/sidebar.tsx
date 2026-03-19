'use client'

import { Button } from '@/components/ui/button'
import { logoutAction } from '@/lib/actions/auth'
import { type RoleT } from '@/lib/auth/roles'
import { SECTION_LINKS } from '@/lib/constants/sections'
import { FileBarChart, LogOut, Shield } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useTransition } from 'react'

type SidebarPropsT = {
  readonly user: {
    readonly name: string
    readonly role: RoleT
  }
}

export function Sidebar({ user }: SidebarPropsT) {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const handleSectionClick = useCallback(
    (e: React.MouseEvent, hash: string) => {
      if (pathname === '/') {
        e.preventDefault()
        window.location.hash = hash
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      }
    },
    [pathname],
  )

  const handleLogout = () => {
    startTransition(() => logoutAction())
  }

  const showReports = user.role === 'ADMIN' || user.role === 'OWNER'

  return (
    <aside className="border-border bg-background sticky top-0 hidden h-screen w-fit min-w-48 shrink-0 flex-col border-r px-3 pb-3 lg:flex">
      {/* Logo + badge — matches top bar min-h-14 */}
      <Link href="/" className={`mx-auto mb-4`}>
        <h1 className="text-md leading-14 font-semibold">Wykończymy 🚧</h1>
      </Link>
      {/* Navigation */}
      <nav className="flex flex-col gap-1">
        {SECTION_LINKS.map((link) => (
          <Button key={link.href} variant="ghost" size="sm" className="justify-start" asChild>
            <Link href={link.href} onClick={(e) => handleSectionClick(e, link.href.slice(1))}>
              <link.icon className="size-4" />
              {link.label}
            </Link>
          </Button>
        ))}
        {showReports && (
          <Button variant="ghost" size="sm" className="justify-start" asChild>
            <Link href="/raporty">
              <FileBarChart className="size-4" />
              Raporty
            </Link>
          </Button>
        )}
      </nav>
      {/* User info + actions */}
      <div className="mt-auto flex flex-col gap-2 pt-4">
        <div className="">
          <div className="text-foreground text-sm font-medium">{user.name}</div>
        </div>
        <div className="flex flex-col gap-2">
          <Button size="sm" asChild aria-label="Panel administracyjny">
            <Link href="/admin" target="_blank">
              <Shield className="size-4" />
              Admin
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={isPending}>
            <LogOut className="size-4" />
            Wyloguj
          </Button>
        </div>
      </div>
    </aside>
  )
}
