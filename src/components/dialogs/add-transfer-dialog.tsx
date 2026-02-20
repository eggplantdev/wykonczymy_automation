'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
import { Loader } from '../ui/loader/loader'
import { FormDialog, type ReferenceDataT } from '@/components/dialogs/form-dialog'

const TransferForm = dynamic(
  () =>
    import('@/components/forms/transfer-form/transfer-form').then((m) => ({
      default: m.TransferForm,
    })),
  { loading: () => <Loader loading />, ssr: false },
)

type AddTransferDialogPropsT = {
  referenceData: ReferenceDataT | undefined
  userCashRegisterIds?: number[]
}

export function AddTransferDialog({ referenceData, userCashRegisterIds }: AddTransferDialogPropsT) {
  if (!referenceData) return <></>

  return (
    <FormDialog
      trigger={
        <Button variant="default" size="sm" className="gap-2">
          <Plus className="size-4" />
          <span className="hidden lg:block">Transfer</span>
        </Button>
      }
      title="Nowy transfer"
      description="Wypełnij formularz, aby dodać nowy transfer."
    >
      {(onSuccess) => (
        <TransferForm
          referenceData={referenceData}
          userCashRegisterIds={userCashRegisterIds}
          onSuccess={onSuccess}
        />
      )}
    </FormDialog>
  )
}
