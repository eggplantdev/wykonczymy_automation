'use client'

import { ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
import { Loader } from '../ui/loader/loader'
import { FormDialog, type ReferenceDataT } from '@/components/dialogs/form-dialog'

const RegisterTransferForm = dynamic(
  () =>
    import('@/components/forms/register-transfer-form/register-transfer-form').then((m) => ({
      default: m.RegisterTransferForm,
    })),
  { loading: () => <Loader loading />, ssr: false },
)

type AddRegisterTransferDialogPropsT = {
  referenceData: ReferenceDataT | undefined
  userCashRegisterIds?: number[]
}

export function AddRegisterTransferDialog({
  referenceData,
  userCashRegisterIds,
}: AddRegisterTransferDialogPropsT) {
  if (!referenceData) return <></>

  return (
    <FormDialog
      trigger={
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
        >
          <span className="hidden lg:block">Kasa</span>
          <ArrowLeftRight className="size-4" />
          <span className="hidden lg:block">Kasa</span>
        </Button>
      }
      title="Transfer między kasami"
      description="Przesuń środki między kasami."
    >
      {(onSuccess) => (
        <RegisterTransferForm
          referenceData={referenceData}
          userCashRegisterIds={userCashRegisterIds}
          onSuccess={onSuccess}
        />
      )}
    </FormDialog>
  )
}
