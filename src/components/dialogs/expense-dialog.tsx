'use client'

import { Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import type { ReferenceDataT } from '@/types/reference-data'
import { ExpenseForm } from '@/components/forms/expense-form/expense-form'

type ExpenseDialogPropsT = {
  referenceData: ReferenceDataT
}

export function ExpenseDialog({ referenceData }: ExpenseDialogPropsT) {
  return (
    <FormDialog
      formId="expense"
      className="max-w-[min(90vw,900px)]"
      trigger={
        <Button variant="default" size="sm" className="gap-2">
          <Rocket className="size-4" />
          <span className="hidden lg:block">Wydatek / zaliczka </span>
        </Button>
      }
      title="Nowy wydatek"
    >
      {(onSuccess, keepOpen) => (
        <ExpenseForm referenceData={referenceData} onSuccess={onSuccess} keepOpen={keepOpen} />
      )}
    </FormDialog>
  )
}
