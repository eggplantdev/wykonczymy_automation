'use client'

import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PropsT = {
  isLoading: boolean
  disabled: boolean
  onClick: () => void
}

export function OpenExpenseDraftButton({ isLoading, disabled, onClick }: PropsT) {
  return (
    <Button size="xs" disabled={disabled} pending={isLoading} onClick={onClick}>
      <Eye />
      Zweryfikuj
    </Button>
  )
}
