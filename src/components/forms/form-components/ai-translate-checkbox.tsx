'use client'

import { WandSparkles } from 'lucide-react'
import { CheckboxRow } from '@/components/ui/checkbox-row'

export function AiTranslateCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <CheckboxRow variant="ai" className="w-fit" checked={checked} onCheckedChange={onCheckedChange}>
      <WandSparkles className="text-neon-cyan size-4" />
      Tłumacz automatycznie przy pomocy AI
    </CheckboxRow>
  )
}
