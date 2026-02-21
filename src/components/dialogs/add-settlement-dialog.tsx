'use client'

import { Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import type { ReferenceDataT } from '@/types/reference-data'
import { SettlementForm } from '@/components/forms/settlement-form/settlement-form'

type AddSettlementDialogPropsT = {
  referenceData: ReferenceDataT | undefined
}

export function AddSettlementDialog({ referenceData }: AddSettlementDialogPropsT) {
  if (!referenceData) return <></>

  // Settlement form expects `users` — filter out admins/owners from worker dropdown
  const settlementReferenceData = {
    users: referenceData.workers.filter((w) => w.type !== 'ADMIN' && w.type !== 'OWNER'),
    investments: referenceData.investments,
    otherCategories: referenceData.otherCategories,
  }

  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm" className="gap-2">
          <Receipt className="size-4" />
          <span className="hidden lg:block">Rozliczenie</span>
        </Button>
      }
      title="Rozliczenie pracownika"
      description='Dodaj pozycje z faktury — każda stanie się osobnym transferem typu "Wydatek pracowniczy".'
      showKeepOpen={false}
    >
      {(onSuccess) => (
        <SettlementForm referenceData={settlementReferenceData} onSuccess={onSuccess} />
      )}
    </FormDialog>
  )
}
