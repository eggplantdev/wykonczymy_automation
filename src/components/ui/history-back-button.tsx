'use client'

import { ArrowLeft } from 'lucide-react'

import { TextButton } from '@/components/ui/text-link'
import { useHistoryBack } from '@/hooks/use-history-back'

export function HistoryBackButton({ fallbackHref }: { fallbackHref: string }) {
  const goBack = useHistoryBack(fallbackHref)

  return (
    <TextButton onClick={goBack}>
      <ArrowLeft className="size-4" />
      Wróć
    </TextButton>
  )
}
