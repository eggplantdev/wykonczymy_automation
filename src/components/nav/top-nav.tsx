import { Suspense } from 'react'
import { DepositDialog } from '@/components/dialogs/deposit-dialog'
import { InternalTransferDialog } from '@/components/dialogs/internal-transfer-dialog'
import { ExpenseDialog } from '@/components/dialogs/expense-dialog'
import { MobileNav } from '@/components/nav/mobile-nav'
import type { ReferenceDataT } from '@/types/reference-data'

type TopNavPropsT = {
  referenceData?: ReferenceDataT
  investmentCrumb: React.ReactNode
}

export function TopNav({ referenceData, investmentCrumb }: TopNavPropsT) {
  return (
    <header className="border-border bg-background sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b p-4 px-3">
      <MobileNav />
      <Suspense fallback={null}>{investmentCrumb}</Suspense>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {referenceData && (
          <>
            <DepositDialog referenceData={referenceData} />
            <InternalTransferDialog referenceData={referenceData} />
            <ExpenseDialog referenceData={referenceData} />
          </>
        )}
      </div>
    </header>
  )
}
