'use client'

import { SaveAsDefaultButton } from '@/components/ui/save-as-default-button'
import { setDefaultCashRegisterAction } from '@/lib/actions/user-preferences'
import { useFieldValue } from '@/components/forms/hooks/use-field-value'
import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'

type SaveDefaultRegisterButtonPropsT = {
  form: FormWithFieldT<'sourceRegister'>
  defaultCashRegisterId?: number
}

const LABELS = {
  isDefault: 'Kasa domyślna',
  save: 'Zapisz jako domyślną kasę',
  saved: 'Domyślna kasa zapisana',
}

export function SaveDefaultRegisterButton({
  form,
  defaultCashRegisterId,
}: SaveDefaultRegisterButtonPropsT) {
  const selectedId = useFieldValue(form, 'sourceRegister')
  if (!selectedId) return null

  return (
    <SaveAsDefaultButton
      selectedId={selectedId}
      defaultId={defaultCashRegisterId === undefined ? undefined : String(defaultCashRegisterId)}
      onSave={(id) => setDefaultCashRegisterAction(Number(id))}
      labels={LABELS}
    />
  )
}
