'use client'

import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'
import { Description } from '@/components/ui/description'
import { cn } from '@/lib/utils/cn'
import type { InvestmentWithDetailsT } from '@/types/reference-data'

type PropsT = {
  investment: InvestmentWithDetailsT
  className?: string
  children: React.ReactNode
}

export function EditInvestmentPrefill({ investment, className, children }: PropsT) {
  return (
    <div className={cn('flex flex-col items-start gap-2', className)}>
      <EditInvestmentDialog investment={investment} triggerText="Edytuj dane inwestycji" />
      <Description size="xs" withIcon={false}>
        {children}
      </Description>
    </div>
  )
}
