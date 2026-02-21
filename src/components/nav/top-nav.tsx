'use client'

import type { ReferenceDataT } from '@/types/reference-data'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const AddTransferDialog = dynamic(() =>
  import('@/components/dialogs/add-transfer-dialog').then((m) => ({
    default: m.AddTransferDialog,
  })),
)

const AddDepositDialog = dynamic(() =>
  import('@/components/dialogs/add-deposit-dialog').then((m) => ({
    default: m.AddDepositDialog,
  })),
)

const AddRegisterTransferDialog = dynamic(() =>
  import('@/components/dialogs/add-register-transfer-dialog').then((m) => ({
    default: m.AddRegisterTransferDialog,
  })),
)

const AddSettlementDialog = dynamic(() =>
  import('@/components/dialogs/add-settlement-dialog').then((m) => ({
    default: m.AddSettlementDialog,
  })),
)

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
            <AddDepositDialog
              referenceData={referenceData}
              userCashRegisterIds={userCashRegisterIds}
            />
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
