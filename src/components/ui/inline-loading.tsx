'use client'

import type { ReactNode } from 'react'

import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/lib/utils/cn'

type InlineLoadingPropsT = {
  label?: ReactNode
  className?: string
}

export function InlineLoading({ label, className }: InlineLoadingPropsT) {
  const { t } = useTranslation('common')

  return (
    <div className={cn('text-muted-foreground flex items-center gap-2 text-sm', className)}>
      <GradientSpinner />
      <span>{label ?? t('loadingData')}</span>
    </div>
  )
}

export function BlockLoading({ className }: { className?: string }) {
  return (
    <div className={cn('flex justify-center py-8', className)}>
      <GradientSpinner className="size-10" />
    </div>
  )
}
