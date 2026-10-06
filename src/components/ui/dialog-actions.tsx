'use client'

import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { useTranslation } from '@/hooks/use-translation'

type PropsT = {
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  confirmDisabled?: boolean
  cancelLabel?: string
  confirmVariant?: React.ComponentProps<typeof Button>['variant']
  // Mirrors ConfirmDialog's pending contract (the AlertDialog-family equivalent).
  pending?: boolean
  pendingLabel?: string
  // For edge-to-edge dialogs (DialogContent p-0) that must pad their own footer.
  className?: string
}

// The Anuluj + primary-action footer every kosztorys/form dialog hand-rolled identically. One place
// so the button order, variants, and spacing stay consistent; the body above it stays per-dialog.
export function DialogActions({
  confirmLabel,
  onConfirm,
  onCancel,
  confirmDisabled = false,
  cancelLabel,
  confirmVariant,
  pending = false,
  pendingLabel,
  className,
}: PropsT) {
  const { t } = useTranslation('common')
  return (
    <DialogFooter className={className}>
      <Button variant="outline" onClick={onCancel} disabled={pending}>
        {cancelLabel ?? t('cancel')}
      </Button>
      <Button variant={confirmVariant} onClick={onConfirm} disabled={confirmDisabled || pending}>
        {pending && pendingLabel ? pendingLabel : confirmLabel}
      </Button>
    </DialogFooter>
  )
}
