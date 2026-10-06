'use client'

import { Eye, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PropsT = {
  isLoading: boolean
  disabled: boolean
  onClick: () => void
}

// The spinner swaps for the icon rather than joining it, so the button — and its column — keeps its
// width while the zgłoszenie's pages download.
export function OpenExpenseDraftButton({ isLoading, disabled, onClick }: PropsT) {
  return (
    <Button size="sm" disabled={disabled} onClick={onClick}>
      {isLoading ? <Loader2 className="animate-spin" /> : <Eye />}
      Zweryfikuj
    </Button>
  )
}
