'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ExtraWorkRows } from '@/components/kosztorys/worker-report/extra-work-rows'
import { blankExtra, extraState } from '@/components/kosztorys/worker-report/extra-state'
import type { ExtraWorkT } from '@/components/kosztorys/worker-report/types'

type PropsT = {
  extras: ExtraWorkT[]
  commonUnits: string[]
  onSave: (extra: ExtraWorkT) => void
  onRemove: (key: string) => void
}

export function ExtraWorksDialogButton({ extras, commonUnits, onSave, onRemove }: PropsT) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCloseRefused, setIsCloseRefused] = useState(false)
  const hasInvalid = extras.some((extra) => extraState(extra) === 'invalid')

  const open = () => {
    if (extras.length === 0) onSave(blankExtra())
    setIsOpen(true)
  }

  // Every way out — „Gotowe”, Esc, a click outside — so a half-filled row cannot hide behind the
  // closed dialog and surface only as a blocked „Wyślij”.
  const close = () => {
    if (hasInvalid) return setIsCloseRefused(true)
    setIsCloseRefused(false)
    setIsOpen(false)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={open}>
        <Plus />
        Nowa praca
        {extras.length > 0 && ` (${extras.length})`}
      </Button>
      <Dialog open={isOpen} onOpenChange={(next) => (next ? setIsOpen(true) : close())}>
        <DialogContent className="sm:max-w-dialog-lg">
          <div className="flex flex-col gap-1">
            <DialogTitle>Prace spoza rozpiski</DialogTitle>
            <DialogDescription>
              Każda praca to osobny wiersz. Stawkę uzupełni kierownik przy weryfikacji.
            </DialogDescription>
          </div>
          <div className="max-h-dialog-scroll overflow-y-auto">
            <ExtraWorkRows
              extras={extras}
              commonUnits={commonUnits}
              onSave={onSave}
              onRemove={onRemove}
              showsMissing={isCloseRefused}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            {isCloseRefused && hasInvalid && (
              <p className="text-destructive text-sm">
                Popraw błędy — uzupełnij opis, j.m. i ilość albo usuń wiersz.
              </p>
            )}
            <Button onClick={close}>Gotowe</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
