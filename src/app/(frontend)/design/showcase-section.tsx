import type { ReactNode } from 'react'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { SHOWCASE_SECTIONS, type ShowcaseSectionIdT } from './showcase-sections'

type ShowcaseSectionPropsT = {
  id: ShowcaseSectionIdT
  children: ReactNode
}

export function ShowcaseSection({ id, children }: ShowcaseSectionPropsT) {
  const label = SHOWCASE_SECTIONS.find((section) => section.id === id)?.label ?? id

  return (
    <CollapsibleSection
      id={id}
      title={label}
      storageKey={`design:${id}`}
      className="scroll-mt-4 pt-8 first:pt-0"
    >
      {children}
    </CollapsibleSection>
  )
}
