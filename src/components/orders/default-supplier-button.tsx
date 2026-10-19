'use client'

import { useState, useTransition } from 'react'
import { Check, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setDefaultSupplierAction } from '@/lib/actions/order-settings'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

type DefaultSupplierButtonPropsT = {
  selectedId: string
  defaultSupplierId: string | undefined
}

export function DefaultSupplierButton({ selectedId, defaultSupplierId }: DefaultSupplierButtonPropsT) {
  // Owned locally after the seed: the refreshed settings arrive with the action's own render, and
  // until then the button would offer to save what it just saved.
  const [savedId, setSavedId] = useState(defaultSupplierId)
  const [isPending, startTransition] = useTransition()

  const isDefault = savedId === selectedId

  function handleSave() {
    startTransition(async () => {
      const result = await settleAction(() => setDefaultSupplierAction(selectedId))
      if (!result.success) {
        toastMessage(result.error, 'error', 4000)
        return
      }
      setSavedId(selectedId)
      toastMessage('Domyślny dostawca zapisany')
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="text-muted-foreground self-start"
      disabled={isDefault || isPending}
      onClick={handleSave}
    >
      {isDefault ? <Check /> : <Star />}
      {isDefault ? 'Dostawca domyślny' : 'Zapisz jako domyślnego dostawcę'}
    </Button>
  )
}
