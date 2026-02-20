'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import dynamic from 'next/dynamic'
import { Loader } from '../ui/loader/loader'
import type { ReferenceDataT } from '@/components/dialogs/add-transfer-dialog'

const DepositForm = dynamic(
  () =>
    import('@/components/forms/deposit-form/deposit-form').then((m) => ({
      default: m.DepositForm,
    })),
  { loading: () => <Loader loading />, ssr: false },
)

type AddDepositDialogPropsT = {
  referenceData: ReferenceDataT | undefined
  userCashRegisterIds?: number[]
}

export function AddDepositDialog({ referenceData, userCashRegisterIds }: AddDepositDialogPropsT) {
  const [isOpen, setIsOpen] = useState(false)
  const [keepOpen, setKeepOpen] = useState(false)

  if (!referenceData) return <></>

  function handleSuccess() {
    if (!keepOpen) setIsOpen(false)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
        onClick={() => setIsOpen(true)}
      >
        <Plus className="size-4" />
        <span className="hidden lg:block">Wpłata</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="h-auto overflow-y-auto sm:max-w-2xl">
          <DialogHeader className={`p-4`}>
            <DialogTitle>Nowa wpłata</DialogTitle>
            <DialogDescription>Dodaj wpłatę do kasy.</DialogDescription>
          </DialogHeader>
          <div className="pr-1">
            <DepositForm
              referenceData={referenceData}
              userCashRegisterIds={userCashRegisterIds}
              onSuccess={handleSuccess}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-4 text-sm select-none">
            <Checkbox
              checked={keepOpen}
              onCheckedChange={(checked) => setKeepOpen(checked === true)}
            />
            Nie zamykaj po zapisaniu
          </label>
        </DialogContent>
      </Dialog>
    </>
  )
}
