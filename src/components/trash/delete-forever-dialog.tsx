'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { deleteInvestmentForeverAction } from '@/lib/actions/investment-trash'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investment: { id: number; name: string; isKosztorysUsed: boolean }
  open: boolean
  onClose: () => void
}

const LOST = 'kosztorys (pozycje i wersje), przypięcia zdjęć, link dla inwestora'

// Typing the name is friction reserved for work someone actually entered — an untouched template
// seed is one click, like any other confirm. The action re-checks the name, so this is not the guard.
export function DeleteForeverDialog({ investment, open, onClose }: PropsT) {
  const router = useRouter()
  const [typedName, setTypedName] = useState('')
  const [pending, startTransition] = useTransition()

  const close = () => {
    setTypedName('')
    onClose()
  }

  const onConfirm = () => {
    startTransition(async () => {
      const res = await deleteInvestmentForeverAction(investment.id, typedName)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się usunąć inwestycji', 'error')
      toastMessage('Inwestycja usunięta na zawsze.', 'success')
      close()
      router.refresh()
    })
  }

  if (!investment.isKosztorysUsed) {
    return (
      <ConfirmDialog
        open={open}
        title="Usunąć na zawsze?"
        description={`„${investment.name}" zniknie bezpowrotnie, razem z: ${LOST}.`}
        confirmLabel="Usuń na zawsze"
        pending={pending}
        pendingLabel="Usuwam…"
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
      description={`Kosztorys tej inwestycji jest w użyciu. Zniknie bezpowrotnie: ${LOST}. Wpisz nazwę „${investment.name}", żeby potwierdzić.`}
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
        aria-label="Nazwa inwestycji"
        autoFocus
      />
    </FormDialogShell>
  )
}
