'use client'

import { useState, useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { DeleteForeverDialog } from '@/components/trash/delete-forever-dialog'
import { restoreInvestmentAction } from '@/lib/actions/investment-trash'
import { toastMessage } from '@/lib/utils/toast'
import type { TrashedInvestmentT } from '@/lib/queries/trash'

export function TrashedInvestmentActions({ investment }: { investment: TrashedInvestmentT }) {
  const [deleting, setDeleting] = useState(false)
  const [pending, startTransition] = useTransition()

  const onRestore = () => {
    startTransition(async () => {
      const res = await restoreInvestmentAction(investment.id)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się przywrócić', 'error')
      toastMessage(
        investment.isTemplate ? 'Szablon przywrócony.' : 'Inwestycja przywrócona.',
        'success',
      )
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <RowActionButton
        icon={RotateCcw}
        label={`Przywróć „${investment.name}"`}
        text="Przywróć"
        showLabel
        disabled={pending}
        onClick={onRestore}
      />
      <DeleteButton
        label={`Usuń „${investment.name}" na zawsze`}
        text="Usuń na zawsze"
        showLabel
        disabled={pending}
        onClick={() => setDeleting(true)}
      />
      <DeleteForeverDialog
        investment={investment}
        open={deleting}
        onClose={() => setDeleting(false)}
      />
    </div>
  )
}
