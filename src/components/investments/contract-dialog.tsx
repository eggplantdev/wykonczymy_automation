'use client'

import { Suspense, useState } from 'react'
import { FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/loader/spinner'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { ContractForm } from '@/components/investments/contract-form'
import { contractPrefillKey } from '@/lib/investments/contract/form-defaults'
import { getContractPlannedNet } from '@/lib/queries/contract-planned-net'
import { logError } from '@/lib/utils/log-error'
import type { InvestmentWithDetailsT } from '@/types/reference-data'

type PropsT = {
  investment: InvestmentWithDetailsT
}

export function ContractDialog({ investment }: PropsT) {
  const [open, setOpen] = useState(false)
  const [plannedNet, setPlannedNet] = useState<Promise<number | undefined>>()

  // Started here, not in render: `use()` on a promise created during render suspends forever.
  function handleOpenChange(next: boolean) {
    if (next) setPlannedNet(loadPlannedNet(investment.id))
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <RowActionButton icon={FileText} label="Umowa" showLabel />
      </DialogTrigger>
      <DialogContent className="sm:max-w-dialog-lg">
        <DialogHeader
          title="Umowa"
          description="Sprawdź dane i wygeneruj umowę do druku lub zapisu jako PDF. Puste pola zostają do wypełnienia długopisem."
        />
        {plannedNet && (
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            }
          >
            {/* Remounted when the investment's prefill changes, so a save in „Edytuj dane inwestycji”
                lands in the contract fields. */}
            <ContractForm
              key={contractPrefillKey(investment)}
              investment={investment}
              plannedNet={plannedNet}
              onClose={() => setOpen(false)}
            />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  )
}

function loadPlannedNet(investmentId: number): Promise<number | undefined> {
  return getContractPlannedNet(investmentId).catch((err: unknown) => {
    // TODO(EX-958) SENTRY-REQUIRED: the contract opens without its kosztorys amount.
    logError(`[contract] przedmiar total failed for #${investmentId}:`, err)
    return undefined
  })
}
