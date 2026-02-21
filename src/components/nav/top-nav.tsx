'use client'

import type { ReferenceDataT } from '@/types/reference-data'
import Link from 'next/link'
import { AddSettlementDialog } from '@/components/dialogs/add-settlement-dialog'
import { AddDepositDialog } from '@/components/dialogs/add-deposit-dialog'
import { AddRegisterTransferDialog } from '@/components/dialogs/add-register-transfer-dialog'
import { AddTransferDialog } from '@/components/dialogs/add-transfer-dialog'

type TopNavPropsT = {
  referenceData?: ReferenceDataT
  userCashRegisterIds?: number[]
}

export function TopNav({ referenceData, userCashRegisterIds }: TopNavPropsT) {
  return (
    <header className="border-border bg-background sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b px-3">
      {/* Left: app name */}
      <Link href="/" className="text-lg font-semibold">
        Wykonczymy
      </Link>

      {/* Right: action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {referenceData && (
          <>
            <AddSettlementDialog referenceData={referenceData} />
            <AddDepositDialog referenceData={referenceData} />
            <AddRegisterTransferDialog
              referenceData={referenceData}
              userCashRegisterIds={userCashRegisterIds}
            />
            <AddTransferDialog
              referenceData={referenceData}
              userCashRegisterIds={userCashRegisterIds}
            />
          </>
        )}
      </div>
    </header>
  )
}
