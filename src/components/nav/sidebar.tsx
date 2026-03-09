'use client'

import { useCallback, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FileBarChart, LogOut, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RoleBadge } from '@/components/ui/badge'
import { SECTION_LINKS } from '@/lib/constants/sections'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { logoutAction } from '@/lib/actions/auth'
import { RainbowButton } from '@/components/ui/rainbow-button'

type SidebarPropsT = {
  readonly user: {
    readonly name: string
    readonly role: RoleT
  }
}

export function Sidebar({ user }: SidebarPropsT) {
  const pathname = usePathname()
  const router = useRouter()
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
    <aside className="border-border bg-background sticky top-0 hidden h-screen w-fit min-w-48 shrink-0 flex-col border-r p-3 lg:flex">
      {/* Logo + badge */}
      <div className="mb-6 flex items-center gap-2">
        {process.env.NODE_ENV === 'development' ? (
          <RainbowButton className={`w-full`} as={Link} href="/">
            <h1 className="text-md font-semibold text-nowrap">Wykończymy 🚧</h1>
          </RainbowButton>
        ) : (
          <Link href="/">
            <h1 className="text-md font-semibold">Wykończymy 🚧</h1>
          </Link>
        )}
      </div>
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
            <Link
              href={`${process.env.NEXT_PUBLIC_FRONTEND_URL}/admin`}
              target="_blank"
              aria-label="Panel administracyjny"
            >
              <Shield className="size-4" />
              Admin
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onMouseEnter={() => router.prefetch('/zaloguj')}
            onClick={handleLogout}
            disabled={isPending}
            aria-label="Wyloguj"
          >
            <LogOut className="size-4" />
            Wyloguj
          </Button>
        </div>
      </div>
    </aside>
  )
}
