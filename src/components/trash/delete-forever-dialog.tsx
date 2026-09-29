'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { deleteInvestmentForeverAction } from '@/lib/actions/investment-trash'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investment: { id: number; name: string; isKosztorysUsed: boolean; isTemplate: boolean }
  open: boolean
  onClose: () => void
}

const INVESTMENT_COPY = {
  lost: 'kosztorys (pozycje i wersje), przypięcia zdjęć, link dla inwestora',
  askReason: 'Kosztorys tej inwestycji jest w użyciu.',
  nameLabel: 'Nazwa inwestycji',
  deleted: 'Inwestycja usunięta na zawsze.',
  failed: 'Nie udało się usunąć inwestycji',
}

const TEMPLATE_COPY = {
  lost: 'sekcje, pozycje i wersje szablonu',
  askReason: 'Kosztorysy założone z tego szablonu zostają bez zmian.',
  nameLabel: 'Nazwa szablonu',
  deleted: 'Szablon usunięty na zawsze.',
  failed: 'Nie udało się usunąć szablonu',
}

export function DeleteForeverDialog({ investment, open, onClose }: PropsT) {
  const copy = investment.isTemplate ? TEMPLATE_COPY : INVESTMENT_COPY
  const [typedName, setTypedName] = useState('')
  const [pending, startTransition] = useTransition()

  const close = () => {
    setTypedName('')
    onClose()
  }

  const onConfirm = () => {
    startTransition(async () => {
      const res = await settleAction(() => deleteInvestmentForeverAction(investment.id, typedName))
      if (!res.success) return toastMessage(res.error ?? copy.failed, 'error')
      toastMessage(copy.deleted, 'success')
      close()
    })
  }

  const mustTypeName = investment.isKosztorysUsed || investment.isTemplate
  if (!mustTypeName) {
    return (
      <ConfirmDialog
        open={open}
        title="Usunąć na zawsze?"
        description={`„${investment.name}" zniknie bezpowrotnie, razem z: ${copy.lost}.`}
        confirmLabel="Usuń na zawsze"
        onConfirm={onConfirm}
        onCancel={close}
      />
    )
  }

  const nameMatches = typedName.trim() === investment.name.trim()

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(next) => !next && close()}
      title="Usunąć na zawsze?"
      description={`${copy.askReason} Zniknie bezpowrotnie: ${copy.lost}. Wpisz nazwę „${investment.name}", żeby potwierdzić.`}
      confirmLabel="Usuń na zawsze"
      onConfirm={onConfirm}
      confirmDisabled={!nameMatches}
      pending={pending}
      pendingLabel="Usuwam…"
    >
      <Input
        value={typedName}
        onChange={(event) => setTypedName(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && nameMatches && !pending && onConfirm()}
        aria-label={copy.nameLabel}
        autoFocus
      />
    </FormDialogShell>
  )
}
