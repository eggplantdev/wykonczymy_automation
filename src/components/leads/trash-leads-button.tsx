'use client'

import { useState, startTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { trashLeadsAction } from '@/lib/actions/lead-trash'
import { pluralize } from '@/lib/utils/polish-plural'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  leadIds: number[]
}

const leadsWord = (count: number) => pluralize(count, ['zgłoszenie', 'zgłoszenia', 'zgłoszeń'])

export function TrashLeadsButton({ leadIds }: PropsT) {
  const [confirming, setConfirming] = useState(false)
  const count = leadIds.length

  const onConfirm = () => {
    startTransition(async () => {
      const res = await settleAction(() => trashLeadsAction(leadIds))
      setConfirming(false)
      if (!res.success) return toastMessage(res.error, 'error')
      const { trashed } = res.data
      toastMessage(`Przeniesiono do kosza: ${trashed} ${leadsWord(trashed)}.`, 'success')
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        <Trash2 />
        Do kosza ({count})
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Przenieść ${count} ${leadsWord(count)} do kosza?`}
        description={`Trafią do kosza i po ${ENTITY_TRASH_RETENTION_DAYS} dniach zostaną usunięte na zawsze. Inwestycje utworzone z tych zgłoszeń i ich pliki zostają nietknięte.`}
        confirmLabel="Przenieś do kosza"
        variant="neutral"
        onConfirm={onConfirm}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
