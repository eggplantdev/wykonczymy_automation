'use client'

import { Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import type { ReferenceDataT } from '@/types/reference-data'
import { SettlementForm } from '@/components/forms/settlement-form/settlement-form'

type AddSettlementDialogPropsT = {
  referenceData: ReferenceDataT
}

export function AddSettlementDialog({ referenceData }: AddSettlementDialogPropsT) {
  // Settlement form uses CashRegisterField with includeTypes/excludeTypes filtering
  const settlementReferenceData = {
    investments: referenceData.investments,
    expenseCategories: referenceData.expenseCategories,
    otherCategories: referenceData.otherCategories,
    cashRegisters: referenceData.cashRegisters,
  }

  return (
    <FormDialog
      formId="settlement"
      trigger={
        <Button variant="outline" size="sm" className="gap-2">
          <Receipt className="size-4" />
          <span className="hidden lg:block">Rozliczenie</span>
        </Button>
      }
      title="Rozliczenie pracownika"
      showKeepOpen={false}
    >
      {(onSuccess, keepOpen) => (
        <SettlementForm
          referenceData={settlementReferenceData}
          onSuccess={onSuccess}
          keepOpen={keepOpen}
        />
      )}
    </FormDialog>
  )
}
