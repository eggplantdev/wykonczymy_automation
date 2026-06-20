'use client'

import { Button } from '@/components/ui/button'
import { logoutAction } from '@/lib/actions/auth'
import { refreshDataAction } from '@/lib/actions/refresh'
import { isAdminOrOwnerRole, isManagementRole } from '@/lib/auth/roles'
import { SECTION_LINKS } from '@/lib/constants/sections'
import { toastMessage } from '@/components/toasts'
import { useCurrentUser } from '@/hooks/use-current-user'
import {
  Calculator,
  FileBarChart,
  FileSpreadsheet,
  LogOut,
  Mail,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useTransition } from 'react'

export function Sidebar() {
  const user = useCurrentUser()
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, startRefreshTransition] = useTransition()

  const handleLogout = () => {
    startTransition(() => logoutAction())
  }

  const handleRefresh = () => {
    startRefreshTransition(async () => {
      await refreshDataAction()
      toastMessage('Dane odświeżone')
    })
  }

  const showUsers = isManagementRole(user.role)
  const showReports = isAdminOrOwnerRole(user.role)

  // Roundcube can't auto-login via URL; _user only prefills the username field on its
  // login page (no-op when a Roundcube session is already active).
  const roundcubeUrl = `https://www.wykonczymy.com.pl/webmail/?_user=${encodeURIComponent(user.email)}`

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
            <Link href={link.href}>
              <link.icon className="size-4" />
              {link.label}
            </Link>
          </Button>
        ))}
        {showUsers && (
          <Button variant="ghost" size="sm" className="justify-start" asChild>
            <Link href="/kosztorysy">
              <FileSpreadsheet className="size-4" />
              Kosztorysy
            </Link>
          </Button>
        )}
        {showUsers && (
          <Button variant="ghost" size="sm" className="justify-start" asChild>
            {/* POC shortcut to the in-app kosztorys editor. Hard-coded to the test
                investment (7 = „test kosztorys Sienicka"); change the id as needed. */}
            <Link href="/inwestycje/7/kosztorys-edytor-v2">
              <Calculator className="size-4" />
              Kosztorys (edytor)
            </Link>
          </Button>
        )}
        {showUsers && (
          <Button variant="ghost" size="sm" className="justify-start" asChild>
            <Link href="/pracownicy">
              <Users className="size-4" />
              Pracownicy
            </Link>
          </Button>
        )}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Odśwież dane"
          >
            <RefreshCw className={isRefreshing ? 'size-4 animate-spin' : 'size-4'} />
            Odśwież dane
          </Button>
          <Button size="sm" asChild aria-label="Panel administracyjny">
            <Link href="/admin" target="_blank">
              <Shield className="size-4" />
              Admin
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild aria-label="Poczta (Roundcube)">
            <Link href={roundcubeUrl} target="_blank" rel="noopener noreferrer">
              <Mail className="size-4" />
              Poczta
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
