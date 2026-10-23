import type { ReactNode } from 'react'

// Kept here, not in collapsible-section: that module is 'use client', and a server component importing
// a plain string from it receives a client reference instead of the string.
export const SECTION_TITLE_CLASS = 'text-lg font-semibold'

export const SECTION_TITLE_MD_CLASS = 'text-base font-semibold'

export const SUBSECTION_TITLE_CLASS = 'text-sm font-semibold'

export const EYEBROW_CLASS = 'text-muted-foreground text-xs font-semibold tracking-wide uppercase'

const HEADER_SIZES = {
  lg: SECTION_TITLE_CLASS,
  md: SECTION_TITLE_MD_CLASS,
  sm: SUBSECTION_TITLE_CLASS,
} as const

type SectionHeaderPropsT = {
  title: ReactNode
  size?: keyof typeof HEADER_SIZES
}

export function SectionHeader({ title, size = 'lg' }: SectionHeaderPropsT) {
  return <h2 className={`text-foreground mb-2 py-2 ${HEADER_SIZES[size]}`}>{title}</h2>
}
