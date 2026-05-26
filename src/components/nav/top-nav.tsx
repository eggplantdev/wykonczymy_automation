'use client'

import { DepositDialog } from '@/components/dialogs/deposit-dialog'
import { InternalTransferDialog } from '@/components/dialogs/internal-transfer-dialog'
import { ExpenseDialog } from '@/components/dialogs/expense-dialog'
import { Button } from '@/components/ui/button'
import type { ReferenceDataT } from '@/types/reference-data'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type TopNavPropsT = {
  referenceData?: ReferenceDataT
}

export function TopNav({ referenceData }: TopNavPropsT) {
  const pathname = usePathname()
  // On a kosztorys page the back target is the same path without the trailing
  // /kosztorys segment, i.e. the investment detail page.
  const investmentHref = pathname.endsWith('/kosztorys')
    ? pathname.slice(0, -'/kosztorys'.length)
    : undefined

  return (
    <header className="border-border bg-background sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b p-4 px-3">
      <div className="flex items-center gap-2 lg:hidden">
        <Link href="/">
          <h1 className="text-md font-semibold"> Wykończymy 🚧</h1>
        </Link>
      </div>
      {investmentHref && (
        <Button variant="outline" size="sm" asChild>
          <Link href={investmentHref}>
            <ArrowLeft className="size-4" />
            Wróć do inwestycji
          </Link>
        </Button>
      )}
      {/* Right: action buttons */}
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
