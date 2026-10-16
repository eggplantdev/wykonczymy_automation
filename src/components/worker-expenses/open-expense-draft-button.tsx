'use client'

import { Eye, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PropsT = {
  isLoading: boolean
  disabled: boolean
  onClick: () => void
}

export function OpenExpenseDraftButton({ isLoading, disabled, onClick }: PropsT) {
  return (
    <Button size="xs" disabled={disabled} onClick={onClick}>
      {isLoading ? <Loader2 className="animate-spin" /> : <Eye />}
      Zweryfikuj
    </Button>
  )
}
