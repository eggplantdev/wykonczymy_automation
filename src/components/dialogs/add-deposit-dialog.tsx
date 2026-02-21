'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import type { ReferenceDataT } from '@/types/reference-data'
import { DepositForm } from '@/components/forms/deposit-form/deposit-form'

type AddDepositDialogPropsT = {
  referenceData: ReferenceDataT | undefined
  userCashRegisterIds?: number[]
}

export function AddDepositDialog({ referenceData, userCashRegisterIds }: AddDepositDialogPropsT) {
  if (!referenceData) return <></>

  return (
    <FormDialog
      trigger={
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
        >
          <Plus className="size-4" />
          <span className="hidden lg:block">Wpłata</span>
        </Button>
      }
      title="Nowa wpłata"
      description="Dodaj wpłatę do kasy."
    >
      {(onSuccess) => (
        <DepositForm
          referenceData={referenceData}
          userCashRegisterIds={userCashRegisterIds}
          onSuccess={onSuccess}
        />
      )}
    </FormDialog>
  )
}
