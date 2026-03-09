'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileBarChart } from 'lucide-react'
import type { ReferenceDataT } from '@/types/reference-data'
import { RoleBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { AddSettlementDialog } from '@/components/dialogs/add-settlement-dialog'
import { AddDepositDialog } from '@/components/dialogs/add-deposit-dialog'
import { AddRegisterTransferDialog } from '@/components/dialogs/add-register-transfer-dialog'
import { AddTransferDialog } from '@/components/dialogs/add-transfer-dialog'
import { SECTION_LINKS } from '@/lib/constants/sections'
import { NavGroupWrapper } from '@/components/nav/nav-group-wrapper'
import { RainbowButton } from '../ui/rainbow-button'

type TopNavPropsT = {
  referenceData?: ReferenceDataT
}

export function TopNav({ referenceData }: TopNavPropsT) {
  const pathname = usePathname()

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

  return (
    <header className="border-border bg-background sticky top-0 z-40 flex min-h-14 items-center justify-between gap-3 border-b p-4 px-3">
      <div className="flex items-center gap-2">
        {process.env.NODE_ENV === 'development' ? (
          <RainbowButton as={Link} href="/">
            <h1 className="text-md font-semibold text-nowrap"> Wykończymy 🚧</h1>
          </RainbowButton>
        ) : (
          <Link href="/">
            <h1 className="text-md font-semibold"> Wykończymy 🚧</h1>
          </Link>
        )}
        {referenceData?.currentUserRole === 'ADMIN' && (
          <RoleBadge role={'ADMIN'}>{'Admin'}</RoleBadge>
        )}
      </div>

      {/* Navigation links */}
      <NavGroupWrapper className="hidden lg:flex">
        {SECTION_LINKS.map((link, i) => (
          <div key={link.href} className="flex items-center">
            <Button variant="ghost" size="sm" asChild>
              <Link href={link.href} onClick={(e) => handleSectionClick(e, link.href.slice(1))}>
                {link.label}
              </Link>
            </Button>
            {i < SECTION_LINKS.length - 1 && <Separator orientation="vertical" />}
          </div>
        ))}
        {(referenceData?.currentUserRole === 'ADMIN' ||
          referenceData?.currentUserRole === 'OWNER') && (
          <>
            <Separator orientation="vertical" />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/raporty">
                <FileBarChart className="size-4" />
                Raporty
              </Link>
            </Button>
          </>
        )}
      </NavGroupWrapper>

      {/* Right: action buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {referenceData && (
          <>
            <AddSettlementDialog referenceData={referenceData} />
            <AddDepositDialog referenceData={referenceData} />
            <AddRegisterTransferDialog referenceData={referenceData} />
            <AddTransferDialog referenceData={referenceData} />
          </>
        )}
      </div>
    </header>
  )
}
