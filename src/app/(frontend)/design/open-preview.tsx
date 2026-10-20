import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { OverlayPreview } from '@/components/ui/overlay-preview'

type OpenPreviewPropsT = {
  backdrop?: boolean
  className?: string
  children: ReactNode
}

export function OpenPreview({ backdrop = true, className, children }: OpenPreviewPropsT) {
  return (
    <OverlayPreview value>
      <div
        className={cn(
          'flex w-full flex-wrap items-start justify-center gap-6 rounded-lg p-6',
          backdrop ? 'bg-black/50' : 'bg-muted',
          className,
        )}
      >
        {children}
      </div>
    </OverlayPreview>
  )
}
