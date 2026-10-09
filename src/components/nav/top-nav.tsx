import { Suspense } from 'react'
import { CompanyKnowledgeButton } from '@/components/company-knowledge/company-knowledge-button'
import { DepositDialog } from '@/components/dialogs/deposit-dialog'
import { InternalTransferDialog } from '@/components/dialogs/internal-transfer-dialog'
import { ExpenseDialog } from '@/components/dialogs/expense-dialog'
import { MobileNav } from '@/components/nav/mobile-nav'
import { StandaloneBackButton } from '@/components/nav/standalone-back-button'
import type { ReferenceDataT } from '@/types/reference-data'

type TopNavPropsT = {
  referenceData?: ReferenceDataT
  investmentCrumb: React.ReactNode
}

export function TopNav({ referenceData, investmentCrumb }: TopNavPropsT) {
  // Unpositioned on purpose. The shell is `flex h-screen` and `<main>` owns the only scroll, so this
  // row never moves and `sticky top-0` had nothing to stick to — while the `z-40` it needed made the
  // header a stacking context that trapped everything inside it, MobileNav's drawer included, under
  // the body-level toasts.
  return (
    <header className="border-border bg-background flex h-14 items-center justify-between gap-3 border-b p-4 px-3">
      <MobileNav />
      <StandaloneBackButton />
      <Suspense fallback={null}>{investmentCrumb}</Suspense>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <CompanyKnowledgeButton className="max-sm:hidden" />
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
