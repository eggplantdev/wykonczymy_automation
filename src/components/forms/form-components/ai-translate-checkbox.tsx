'use client'

import { CheckboxRow } from '@/components/ui/checkbox-row'

export function AiTranslateCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <CheckboxRow checked={checked} onCheckedChange={onCheckedChange}>
      Tłumacz automatycznie przy pomocy AI
    </CheckboxRow>
  )
}
