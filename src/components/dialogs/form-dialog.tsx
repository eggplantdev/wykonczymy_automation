'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

export type ReferenceItemT = { id: number; name: string; type?: string }

export type ReferenceDataT = {
  cashRegisters: ReferenceItemT[]
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
  otherCategories: ReferenceItemT[]
}

type FormDialogPropsT = {
  trigger: React.ReactNode
  title: string
  description: string
  showKeepOpen?: boolean
  children: (onSuccess: () => void) => React.ReactNode
}

export function FormDialog({
  trigger,
  title,
  description,
  showKeepOpen = true,
  children,
}: FormDialogPropsT) {
  const [isOpen, setIsOpen] = useState(false)
  const [keepOpen, setKeepOpen] = useState(false)

  function handleSuccess() {
    if (!keepOpen) setIsOpen(false)
  }

  return (
    <>
      <span onClick={() => setIsOpen(true)}>{trigger}</span>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="h-fit max-h-[80vh] sm:max-w-2xl">
          <div className="h-auto">
            <DialogHeader className="">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="pr-1">{children(handleSuccess)}</div>
            {showKeepOpen && (
              <label className="flex cursor-pointer items-center gap-2 py-4 text-sm select-none">
                <Checkbox
                  checked={keepOpen}
                  onCheckedChange={(checked) => setKeepOpen(checked === true)}
                />
                Nie zamykaj po zapisaniu
              </label>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
