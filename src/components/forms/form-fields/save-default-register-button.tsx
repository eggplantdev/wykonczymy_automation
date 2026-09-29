'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setDefaultCashRegisterAction } from '@/lib/actions/user-preferences'
import { useFieldValue } from '@/components/forms/hooks/use-field-value'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'

type SaveDefaultRegisterButtonPropsT = {
  form: FormWithFieldT<'sourceRegister'>
  defaultCashRegisterId?: number
}

export function SaveDefaultRegisterButton({
  form,
  defaultCashRegisterId,
}: SaveDefaultRegisterButtonPropsT) {
  const selectedId = useFieldValue(form, 'sourceRegister')
  // Seeded from the server value but owned locally afterwards: `router.refresh()` below re-fetches
  // the reference data, and until that lands the button would otherwise still offer to save what it
  // just saved.
  const [savedId, setSavedId] = useState(defaultCashRegisterId)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (!selectedId) return null

  const isDefault = savedId !== undefined && String(savedId) === selectedId

  function handleSave() {
    startTransition(async () => {
      const result = await settleAction(() => setDefaultCashRegisterAction(Number(selectedId)))
      if (!result.success) {
        toastMessage(result.error, 'error', 4000)
        return
      }
      setSavedId(Number(selectedId))
      toastMessage('Domyślna kasa zapisana')
      router.refresh()
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
      {isDefault ? 'Kasa domyślna' : 'Zapisz jako domyślną kasę'}
    </Button>
  )
}
