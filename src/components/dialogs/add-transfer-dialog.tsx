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

const TransferForm = dynamic(
  () =>
    import('@/components/forms/transfer-form/transfer-form').then((m) => ({
      default: m.TransferForm,
    })),
  { loading: () => <Loader loading />, ssr: false },
)

export type ReferenceItemT = { id: number; name: string; type?: string }

export type ReferenceDataT = {
  cashRegisters: ReferenceItemT[]
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
  otherCategories: ReferenceItemT[]
}

type AddTransferDialogPropsT = {
  referenceData: ReferenceDataT | undefined
  managerCashRegisterId?: number
  variant?: 'default' | 'icon'
}

export function AddTransferDialog({
  referenceData,
  managerCashRegisterId,
}: AddTransferDialogPropsT) {
  const [isOpen, setIsOpen] = useState(false)
  const [keepOpen, setKeepOpen] = useState(false)

  if (!referenceData) return <></>

  function handleSuccess() {
    if (!keepOpen) setIsOpen(false)
  }

  return (
    <>
      <Button variant="default" size="sm" className="gap-2" onClick={() => setIsOpen(true)}>
        <Plus className="size-4" />
        <span className="hidden lg:block">Transfer</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="h-auto overflow-y-auto sm:max-w-2xl">
          <DialogHeader className={`p-4`}>
            <DialogTitle>Nowy transfer</DialogTitle>
            <DialogDescription>Wypełnij formularz, aby dodać nowy transfer.</DialogDescription>
          </DialogHeader>
          <div className="pr-1">
            <TransferForm
              referenceData={referenceData}
              managerCashRegisterId={managerCashRegisterId}
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
