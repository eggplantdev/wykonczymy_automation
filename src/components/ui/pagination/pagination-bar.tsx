'use client'

import type { ReactNode } from 'react'
import { SimpleSelect } from '@/components/ui/simple-select'
import { ALLOWED_LIMITS } from '@/lib/utils/pagination'
import { cn } from '@/lib/utils/cn'
import { useTranslation } from '@/hooks/use-translation'

const LIMIT_OPTIONS = ALLOWED_LIMITS.map((n) => ({ value: String(n), label: n }))

type PaginationBarPropsT = {
  totalDocs: number
  limit: number
  onLimitChange: (limit: number) => void
  /** The page switch — URL links or local buttons, whichever the caller keeps its page in. */
  children?: ReactNode
  className?: string
}

export function PaginationBar({
  totalDocs,
  limit,
  onLimitChange,
  children,
  className,
}: PaginationBarPropsT) {
  const { t, tp } = useTranslation('filters')

  return (
    <div className={cn('mt-4 flex flex-wrap items-center justify-between gap-4', className)}>
      <div className="flex items-center gap-3">
        <p className="text-muted-foreground text-sm">{tp('results', totalDocs)}</p>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">{t('show')}</span>
          <SimpleSelect
            value={String(limit)}
            onValueChange={(value) => onLimitChange(Number(value))}
            options={LIMIT_OPTIONS}
            className="h-7 w-20"
          />
        </div>
      </div>
      {children}
    </div>
  )
}
