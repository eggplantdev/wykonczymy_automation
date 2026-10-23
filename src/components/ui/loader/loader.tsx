'use client'

import { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ContentLoading } from './page-loading'
import { cn } from '@/lib/utils/cn'

export type PropsT = {
  loading: boolean
  loaderComponent?: ReactNode
  className?: string
  portal?: boolean
}

export const Loader = ({ loading, loaderComponent, className, portal }: PropsT) => {
  if (!loading) return null

  const spinner = loaderComponent ?? <ContentLoading />

  const comp = (
    <div
      id="loader"
      className={cn(
        `pointer-events-none fixed inset-0 z-100000000 flex items-center justify-center`,
        className,
      )}
    >
      {spinner}
    </div>
  )

  if (portal) return createPortal(comp, document.body)

  return comp
}
