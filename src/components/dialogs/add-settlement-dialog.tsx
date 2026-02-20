'use client'

import { useState } from 'react'
import { Receipt } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
import type { ReferenceDataT } from '@/components/dialogs/add-transfer-dialog'
import { Loader } from '../ui/loader/loader'

const SettlementForm = dynamic(
  () =>
    import('@/components/forms/settlement-form/settlement-form').then((m) => ({
      default: m.SettlementForm,
    })),
  {
    loading: () => <Loader loading />,
    ssr: false,
  },
)

type AddSettlementDialogPropsT = {
  referenceData: ReferenceDataT | undefined
}

export function AddSettlementDialog({ referenceData }: AddSettlementDialogPropsT) {
  const [isOpen, setIsOpen] = useState(false)

  if (!referenceData) return <></>

  // Settlement form expects `users` — filter out admins/owners from worker dropdown
  const settlementReferenceData = {
    users: referenceData.workers.filter((w) => w.type !== 'ADMIN' && w.type !== 'OWNER'),
    investments: referenceData.investments,
    otherCategories: referenceData.otherCategories,
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsOpen(true)}>
        <Receipt className="size-4" />
        <span className="hidden lg:block">Rozliczenie</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="p-4">
            <DialogTitle>Rozliczenie pracownika</DialogTitle>
            <DialogDescription>
              Dodaj pozycje z faktury — każda stanie się osobnym transferem typu &quot;Wydatek
              pracowniczy&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="pr-1">
            <SettlementForm
              referenceData={settlementReferenceData}
              onSuccess={() => setIsOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
