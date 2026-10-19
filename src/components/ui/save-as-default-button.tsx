'use client'

import { useState, useTransition } from 'react'
import { Check, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

type SaveAsDefaultButtonPropsT = {
  selectedId: string
  defaultId: string | undefined
  onSave: (selectedId: string) => Promise<ActionResultT>
  labels: { isDefault: string; save: string; saved: string }
}

export function SaveAsDefaultButton({
  selectedId,
  defaultId,
  onSave,
  labels,
}: SaveAsDefaultButtonPropsT) {
  // Owned locally after the seed: the refreshed data arrives with the action's own render, and
  // until then the button would offer to save what it just saved.
  const [savedId, setSavedId] = useState(defaultId)
  const [isPending, startTransition] = useTransition()

  const isDefault = savedId === selectedId

  function handleSave() {
    startTransition(async () => {
      const result = await settleAction(() => onSave(selectedId))
      if (!result.success) {
        toastMessage(result.error, 'error', 4000)
        return
      }
      setSavedId(selectedId)
      toastMessage(labels.saved)
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="text-muted-foreground self-start justify-self-start"
      disabled={isDefault || isPending}
      onClick={handleSave}
    >
      {isDefault ? <Check /> : <Star />}
      {isDefault ? labels.isDefault : labels.save}
    </Button>
  )
}
