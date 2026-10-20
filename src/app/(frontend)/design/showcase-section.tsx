import type { ReactNode } from 'react'
import { SHOWCASE_SECTIONS, type ShowcaseSectionIdT } from './showcase-sections'

type ShowcaseSectionPropsT = {
  id: ShowcaseSectionIdT
  children: ReactNode
}

export function ShowcaseSection({ id, children }: ShowcaseSectionPropsT) {
  const label = SHOWCASE_SECTIONS.find((section) => section.id === id)?.label

  return (
    <section id={id} className="scroll-mt-4 pt-8 first:pt-0">
      <h2 className="border-b-2 pb-2 text-lg font-semibold">{label}</h2>
      {children}
    </section>
  )
}
