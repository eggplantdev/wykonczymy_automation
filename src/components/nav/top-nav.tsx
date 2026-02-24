'use client'

import Link from 'next/link'
import type { RoleT } from '@/lib/auth/roles'
import { ROLE_LABELS } from '@/lib/auth/roles'
import type { ReferenceDataT } from '@/types/reference-data'
import { RoleBadge } from '@/components/ui/badge'
import { AddSettlementDialog } from '@/components/dialogs/add-settlement-dialog'
import { AddDepositDialog } from '@/components/dialogs/add-deposit-dialog'
import { AddRegisterTransferDialog } from '@/components/dialogs/add-register-transfer-dialog'
import { AddTransferDialog } from '@/components/dialogs/add-transfer-dialog'
import { RainbowButton } from '../ui/rainbow-button'

type TopNavPropsT = {
  referenceData?: ReferenceDataT
}

export function TopNav({ referenceData }: TopNavPropsT) {
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
