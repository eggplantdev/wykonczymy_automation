'use client'

import { Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import type { ReferenceDataT } from '@/types/reference-data'
import { ExpenseForm } from '@/components/forms/expense-form/expense-form'

type ExpenseDialogPropsT = {
  referenceData: ReferenceDataT
}

export function ExpenseDialog({ referenceData }: ExpenseDialogPropsT) {
  return (
    <FormDialog
      formId="expense"
      className="sm:max-w-dialog-lg"
      trigger={
        <Button variant="red" size="sm">
          <Rocket />
          <span className="hidden lg:block">Wydatek </span>
        </Button>
      }
      title="Nowy wydatek"
    >
      {(onSubmitSuccess, keepOpen) => (
        <ExpenseForm
          referenceData={referenceData}
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
        />
      )}
    </FormDialog>
  )
}
