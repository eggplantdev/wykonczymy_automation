import { Suspense } from 'react'
import Link from 'next/link'
import { DepositDialog } from '@/components/dialogs/deposit-dialog'
import { InternalTransferDialog } from '@/components/dialogs/internal-transfer-dialog'
import { ExpenseDialog } from '@/components/dialogs/expense-dialog'
import { NavBackButton } from '@/components/nav/nav-back-button'
import { NavOpenRouterBalance } from '@/components/nav/nav-openrouter-balance'
import type { ReferenceDataT } from '@/types/reference-data'

type TopNavPropsT = {
  referenceData?: ReferenceDataT
}

export function TopNav({ referenceData }: TopNavPropsT) {
  return (
    <header className="border-border bg-background sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b p-4 px-3">
      <div className="flex items-center gap-2 lg:hidden">
        <Link href="/">
          <h1 className="text-md font-semibold"> Wykończymy 🚧</h1>
        </Link>
      </div>
      <NavBackButton />
      {/* Right: action buttons */}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <Suspense fallback={null}>
          <NavOpenRouterBalance />
        </Suspense>
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
