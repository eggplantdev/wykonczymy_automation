import type { ReactNode } from 'react'

// Kept here, not in collapsible-section: that module is 'use client', and a server component importing
// a plain string from it receives a client reference instead of the string.
export const SECTION_TITLE_CLASS = 'text-lg font-semibold'

// py-2 matches a large CollapsibleSection's trigger, so a static heading lines up with its neighbours.
export function SectionHeader({ title }: { title: ReactNode }) {
  return <h2 className={`text-foreground mb-2 py-2 ${SECTION_TITLE_CLASS}`}>{title}</h2>
}
