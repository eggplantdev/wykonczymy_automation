'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ExtraWorkRows } from '@/components/kosztorys/worker-report/extra-work-rows'
import type { ExtraWorkT } from '@/components/kosztorys/worker-report/types'

type PropsT = {
  extras: ExtraWorkT[]
  commonUnits: string[]
  onSave: (extra: ExtraWorkT) => void
  onRemove: (key: string) => void
}

const blankExtra = (): ExtraWorkT => ({
  key: crypto.randomUUID(),
  description: '',
  unit: '',
  qty: '',
})

export function ExtraWorksDialogButton({ extras, commonUnits, onSave, onRemove }: PropsT) {
  const [isOpen, setIsOpen] = useState(false)

  const open = () => {
    // Opens on a row to type into rather than on an empty list with a button.
    if (extras.length === 0) onSave(blankExtra())
    setIsOpen(true)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={open}>
        <Plus />
        Nowa praca
        {extras.length > 0 && ` (${extras.length})`}
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setIsOpen(false)}>Gotowe</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
