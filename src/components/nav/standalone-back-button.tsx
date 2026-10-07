'use client'

import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useHistoryBack } from '@/components/ui/use-history-back'
import { useTranslation } from '@/hooks/use-translation'

export function StandaloneBackButton() {
  const goBack = useHistoryBack('/')
  const { t } = useTranslation('shell')

  return (
    <Button
      variant="ghost"
      size="icon"
      className="standalone:max-sm:inline-flex hidden size-11"
      aria-label={t('back')}
      onClick={goBack}
    >
      <ArrowLeft className="size-7" />
    </Button>
  )
}
