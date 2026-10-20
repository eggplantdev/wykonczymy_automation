'use client'

import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/lib/utils/cn'

function GradientSpinner({ className, ...props }: React.ComponentProps<'div'>) {
  const { t } = useTranslation('common')

  return (
    <div
      role="status"
      aria-label={t('loading')}
      className={cn('gradient-spinner size-4 shrink-0 animate-spin', className)}
      {...props}
    />
  )
}

export { GradientSpinner }
