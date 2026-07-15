'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, Unlink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toastMessage } from '@/lib/utils/toast'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { unlinkSheetFromInvestmentAction, deleteSheetAction } from '@/lib/actions/sheets'

type PropsT = {
  sheetId: number
  investmentId: number
  investmentName: string
}

// Which confirm dialog (if any) is open. Both share one piece of state because
// only one can be open at a time — triggered from its own button, never together.
type DialogT = 'unlink' | 'delete' | undefined

// Row actions for a sheet that is linked to an investment, rendered as three
// standalone buttons: open the embedded sheet, the reversible "unlink", and the
// destructive "delete". The unlink/delete buttons each gate behind a confirm
// step. Both server actions re-check permissions — the client gate on "delete"
// only hides a button the user can't use anyway.
export function LinkedSheetActions({ sheetId, investmentId, investmentName }: PropsT) {
  const [dialog, setDialog] = useState<DialogT>(undefined)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const { role } = useCurrentUser()
  const canDelete = isAdminOrOwnerRole(role)

  const onUnlink = () => {
    startTransition(async () => {
      const res = await unlinkSheetFromInvestmentAction(sheetId)
      if (!res.success) return toastMessage(res.error, 'error')
      toastMessage(`Odłączono kosztorys od inwestycji „${investmentName}”.`, 'success')
      setDialog(undefined)
      router.refresh()
    })
  }

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteSheetAction(sheetId)
      if (!res.success) return toastMessage(res.error, 'error')
      toastMessage('Usunięto kosztorys.', 'success')
      setDialog(undefined)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button size="sm" asChild>
        <Link href={`/inwestycje/${investmentId}/kosztorys`}>
          <FileSpreadsheet className="size-4" />
          Otwórz
        </Link>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setDialog('unlink')}>
        <Unlink className="size-4" />
        Odłącz
      </Button>

      {canDelete && (
        <Button size="sm" variant="destructive" onClick={() => setDialog('delete')}>
          <Trash2 className="size-4" />
          Usuń
        </Button>
      )}

      <ConfirmDialog
        open={dialog === 'unlink'}
        title="Odłączyć kosztorys od inwestycji?"
        description="Arkusz Google nie zostanie usunięty — pozostanie na liście jako kosztorys bez inwestycji i można go później powiązać ponownie."
        confirmLabel="Odłącz"
        pending={pending}
        pendingLabel="Odłączam…"
        onConfirm={onUnlink}
        onCancel={() => setDialog(undefined)}
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        title="Usunąć kosztorys?"
        description="Usunięty zostanie tylko wpis w aplikacji. Arkusz Google pozostanie nienaruszony na Dysku. Tej operacji nie można cofnąć."
        confirmLabel="Usuń"
        pending={pending}
        pendingLabel="Usuwam…"
        onConfirm={onDelete}
        onCancel={() => setDialog(undefined)}
      />
    </div>
  )
}
