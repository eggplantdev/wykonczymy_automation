'use client'

import { Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import type { ReferenceDataT } from '@/types/reference-data'
import { SettlementForm } from '@/components/forms/settlement-form/settlement-form'
import { MANAGEMENT_ROLES, RoleT } from '@/lib/auth/roles'

type AddSettlementDialogPropsT = {
  referenceData: ReferenceDataT
}

export function AddSettlementDialog({ referenceData }: AddSettlementDialogPropsT) {
  const defaultCashRegisterId = referenceData.workers.find(
    (w) => w.id === referenceData.currentUserId,
  )?.defaultCashRegisterId

  // Settlement form expects `users` — filter out admins/owners from worker dropdown
  const settlementReferenceData = {
    users: referenceData.workers.filter((w) => !MANAGEMENT_ROLES.includes(w.type as RoleT)),
    investments: referenceData.investments,
    otherCategories: referenceData.otherCategories,
    cashRegisters: referenceData.cashRegisters.filter((cr) => cr.type !== 'VIRTUAL'),
    defaultCashRegisterId,
  }

  return (
    <FormDialog
      formId="settlement"
      trigger={
        <Button variant="outline" size="sm" className="gap-2">
          <Receipt className="size-4" />
          <span className="hidden lg:block">Rozliczenie</span>
        </Button>
      }
      title="Rozliczenie pracownika"
      showKeepOpen={false}
    >
      {(onSuccess) => (
        <SettlementForm referenceData={settlementReferenceData} onSuccess={onSuccess} />
      )}
    </FormDialog>
  )
}
