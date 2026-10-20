import type { ReactNode } from 'react'

import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { PageWrapper } from '@/components/ui/page-wrapper'

// Route-segment fallback: sits inside the layout's <main>, so it fills the flex row
// rather than the viewport (h-screen here would overflow that scroll container).
export function PageLoading() {
  return (
    <div className="flex w-full flex-1 items-center justify-center">
      <ContentLoading />
    </div>
  )
}

export function ContentLoading() {
  return <GradientSpinner className="size-10" />
}

export function OverlayLoading() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <ContentLoading />
    </div>
  )
}

export function TitledPageLoading({ title }: { title: ReactNode }) {
  return (
    <PageWrapper title={title} className="relative flex-1">
      <OverlayLoading />
    </PageWrapper>
  )
}

export function DetailPageLoading() {
  return (
    <TitledPageLoading
      title={<span className="bg-muted block h-lh w-64 max-w-full animate-pulse rounded-md" />}
    />
  )
}
