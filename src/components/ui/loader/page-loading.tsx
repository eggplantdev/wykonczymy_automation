import type { ReactNode } from 'react'

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
  return <p className="animate-bounce text-3xl font-semibold lg:text-5xl">🚧</p>
}

// A route's `loading.tsx` is the only part of a dynamic page the router prefetches (PPR is off),
// so a title rendered here is on screen the moment the link is clicked — the page's own heading
// replaces it in the same box once the server answers.
export function TitledPageLoading({ title }: { title: ReactNode }) {
  return (
    <PageWrapper title={title} className="relative flex-1">
      <div className="absolute inset-0 flex items-center justify-center">
        <ContentLoading />
      </div>
    </PageWrapper>
  )
}

// A detail page's title is the record's name, which no prefetch can carry — a bar one heading line
// tall holds its place until the name arrives.
export function DetailPageLoading() {
  return (
    <TitledPageLoading
      title={<span className="bg-muted block h-lh w-64 max-w-full animate-pulse rounded-md" />}
    />
  )
}
