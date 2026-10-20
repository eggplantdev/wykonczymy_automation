'use client'

import { ShowcaseToc } from './showcase-toc'
import { ColorsSection } from './sections/colors-section'
import { TypographySection } from './sections/typography-section'
import { RadiusShadowSection } from './sections/radius-shadow-section'
import { BadgesSection } from './sections/badges-section'

export function DesignSystem() {
  return (
    <div className="flex gap-6 p-4 sm:p-6">
      <ShowcaseToc />
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="pb-6 text-2xl font-semibold">Design system</h1>
        <ColorsSection />
        <TypographySection />
        <RadiusShadowSection />
        <BadgesSection />
      </div>
    </div>
  )
}
