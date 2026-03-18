'use client'

import { Button } from '@/components/ui/button'
import { logoutAction } from '@/lib/actions/auth'
import { isAdminOrOwnerRole, type RoleT } from '@/lib/auth/roles'
import { SECTION_LINKS } from '@/lib/constants/sections'
import { FileBarChart, LogOut, Shield } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

function navigateToHash(hash: string) {
  window.location.hash = hash
  //When you click "Kasy" and the hash is already #kasy, the browser sees window.location.hash = 'kasy' as a no-op — the value didn't change, so it doesn't fire
  // the hashchange event. The CollapsibleSection listener never triggers, so nothing scrolls or opens.
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

type SidebarPropsT = {
  readonly user: {
    readonly name: string
    readonly role: RoleT
  }
}

export function Sidebar({ user }: SidebarPropsT) {
  const pathname = usePathname()

  function handleSectionClick(e: React.MouseEvent, hash: string) {
    e.preventDefault()
    if (pathname === '/') navigateToHash(hash)
  }

  return (
    <aside className="border-border bg-background sticky top-0 hidden h-screen w-fit min-w-48 shrink-0 flex-col border-r px-3 pb-3 lg:flex">
      <Link href="/" className={`mx-auto mb-4`}>
        <h1 className="text-md leading-14 font-semibold">Wykończymy 🚧</h1>
      </Link>
      <nav className="flex flex-col gap-1">
        {SECTION_LINKS.map((link) => (
          <Button key={link.href} variant="ghost" size="sm" className="justify-start" asChild>
            <Link href={link.href} onClick={(e) => handleSectionClick(e, link.href.slice(1))}>
              <link.icon className="size-4" />
              {link.label}
            </Link>
          </Button>
        ))}
        {isAdminOrOwnerRole(user.role) && (
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
          <Button variant="outline" size="sm" onClick={() => logoutAction()}>
            <LogOut className="size-4" />
            Wyloguj
          </Button>
        </div>
      </div>
    </aside>
  )
}
