'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { SHOWCASE_SECTIONS, type ShowcaseSectionIdT } from './showcase-sections'

// The band a section must reach to count as current: the top 40% of the viewport.
const ACTIVE_BAND_MARGIN = '0px 0px -60% 0px'

function useActiveSection() {
  const [activeId, setActiveId] = useState<ShowcaseSectionIdT>(SHOWCASE_SECTIONS[0].id)

  useEffect(() => {
    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        const topmost = SHOWCASE_SECTIONS.find((section) => visible.has(section.id))
        if (topmost) setActiveId(topmost.id)
      },
      { rootMargin: ACTIVE_BAND_MARGIN },
    )
    for (const section of SHOWCASE_SECTIONS) {
      const element = document.getElementById(section.id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [])

  return activeId
}

export function ShowcaseToc() {
  const activeId = useActiveSection()

  return (
    <nav className="sticky top-0 hidden w-48 shrink-0 self-start py-4 sm:block">
      <ul className="flex flex-col gap-1 text-sm">
        {SHOWCASE_SECTIONS.map((section) => {
          const isActive = section.id === activeId
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  'hover:text-foreground hover:bg-accent block rounded-md px-2 py-1',
                  isActive ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground',
                )}
              >
                {section.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
