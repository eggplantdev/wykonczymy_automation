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
  pending?: boolean
  pendingLabel?: string
  className?: string
}

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
