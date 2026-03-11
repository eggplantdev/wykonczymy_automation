'use client'

import { AddDepositDialog } from '@/components/dialogs/add-deposit-dialog'
import { AddRegisterTransferDialog } from '@/components/dialogs/add-register-transfer-dialog'
import { AddExpenseDialog } from '@/components/dialogs/add-expense-dialog'
import type { ReferenceDataT } from '@/types/reference-data'
import Link from 'next/link'

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
      {/* Right: action buttons */}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {referenceData && (
          <>
            <AddDepositDialog referenceData={referenceData} />
            <AddRegisterTransferDialog referenceData={referenceData} />
            <AddExpenseDialog referenceData={referenceData} />
          </>
        )}
      </div>
    </header>
  )
}
