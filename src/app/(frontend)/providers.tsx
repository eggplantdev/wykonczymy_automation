'use client'

import { ProgressProvider } from '@bprogress/next/app'
import type { ReactNode } from 'react'

type ProvidersPropsT = {
  readonly children: ReactNode
}

export function Providers({ children }: ProvidersPropsT) {
  return (
    <ProgressProvider
      height="2px"
      color="oklch(0.205 0 0)"
      options={{ showSpinner: false }}
      shallowRouting
    >
      {children}
    </ProgressProvider>
  )
}
