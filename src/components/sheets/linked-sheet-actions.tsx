'use client'

import { useState, startTransition } from 'react'
import Link from 'next/link'
import { FileSpreadsheet, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { unlinkSheetFromInvestmentAction, deleteSheetAction } from '@/lib/actions/sheets'

type PropsT = {
  sheetId: number
  investmentId: number
  investmentName: string
}

// One piece of state because only one can be open at a time.
type DialogT = 'unlink' | 'delete' | undefined

// Both server actions re-check permissions — the client gate on "delete" only hides a button the user
// can't use anyway.
export function LinkedSheetActions({ sheetId, investmentId, investmentName }: PropsT) {
  const [dialog, setDialog] = useState<DialogT>(undefined)
  const { role } = useCurrentUser()
  const canDelete = isAdminOrOwnerRole(role)

  const onUnlink = () => {
    startTransition(async () => {
      const res = await settleAction(() => unlinkSheetFromInvestmentAction(sheetId))
      if (!res.success) return toastMessage(res.error, 'error')
      toastMessage(`Odłączono kosztorys od inwestycji „${investmentName}”.`, 'success')
      setDialog(undefined)
    })
  }

  const onDelete = () => {
    startTransition(async () => {
      const res = await settleAction(() => deleteSheetAction(sheetId))
      if (!res.success) return toastMessage(res.error, 'error')
      toastMessage('Usunięto kosztorys.', 'success')
      setDialog(undefined)
    })
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button size="sm" asChild>
        <Link href={`/inwestycje/${investmentId}/kosztorys`}>
          <FileSpreadsheet />
          Arkusz
        </Link>
      </Button>

      {/* The link above keeps its label — it goes somewhere. These two CHANGE something, so they
          take the same icon shape the action column of every other table uses. */}
      <RowActionButton
        icon={Unlink}
        label="Odłącz od inwestycji"
        onClick={() => setDialog('unlink')}
      />

      {canDelete && <DeleteButton label="Usuń kosztorys" onClick={() => setDialog('delete')} />}

      <ConfirmDialog
        open={dialog === 'unlink'}
        title="Odłączyć kosztorys od inwestycji?"
        description="Arkusz Google nie zostanie usunięty — pozostanie na liście jako kosztorys bez inwestycji i można go później powiązać ponownie."
        confirmLabel="Odłącz"
        variant="neutral"
        onConfirm={onUnlink}
        onCancel={() => setDialog(undefined)}
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        title="Usunąć kosztorys?"
        description="Usunięty zostanie tylko wpis w aplikacji. Arkusz Google pozostanie nienaruszony na Dysku. Tej operacji nie można cofnąć."
        confirmLabel="Usuń"
        onConfirm={onDelete}
        onCancel={() => setDialog(undefined)}
      />
    </div>
  )
}
