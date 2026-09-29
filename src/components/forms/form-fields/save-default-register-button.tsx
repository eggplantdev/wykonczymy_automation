'use client'

import { useState, useTransition } from 'react'
import { Check, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setDefaultCashRegisterAction } from '@/lib/actions/user-preferences'
import { useFieldValue } from '@/components/forms/hooks/use-field-value'
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
  // Seeded from the server value but owned locally afterwards: the fresh value arrives with the
  // action's own render, and until that lands the button would otherwise still offer to save what
  // it just saved.
  const [savedId, setSavedId] = useState(defaultCashRegisterId)
  const [isPending, startTransition] = useTransition()

  if (!selectedId) return null

  const isDefault = savedId !== undefined && String(savedId) === selectedId

  function handleSave() {
    startTransition(async () => {
      const result = await setDefaultCashRegisterAction(Number(selectedId))
      if (!result.success) {
        toastMessage(result.error, 'error', 4000)
        return
      }
      setSavedId(Number(selectedId))
      toastMessage('Domyślna kasa zapisana')
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
