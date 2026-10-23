'use client'

import { ShowcaseToc } from './showcase-toc'
import { ColorsSection } from './sections/colors-section'
import { TypographySection } from './sections/typography-section'
import { RadiusShadowSection } from './sections/radius-shadow-section'
import { TokensSection } from './sections/tokens-section'
import { IconsSection } from './sections/icons-section'
import { BadgesSection } from './sections/badges-section'
import { ButtonsSection } from './sections/buttons-section'
import { FieldsSection } from './sections/fields-section'
import { OverlaysSection } from './sections/overlays-section'
import { DialogsSection } from './sections/dialogs-section'
import { FeedbackSection } from './sections/feedback-section'
import { LayoutSection } from './sections/layout-section'
import { NavigationSection } from './sections/navigation-section'
import { DataDisplaySection } from './sections/data-display-section'
import { TablesSection } from './sections/tables-section'
import { CardsSection } from './sections/cards-section'
import { StatusesSection } from './sections/statuses-section'
import { BannersSection } from './sections/banners-section'
import { FiltersSection } from './sections/filters-section'
import { FormCompositesSection } from './sections/form-composites-section'
import { MediaSection } from './sections/media-section'
import { GridCellsSection } from './sections/grid-cells-section'

export function DesignSystem() {
  return (
    <div className="flex gap-6 p-4 sm:p-6">
      <ShowcaseToc />
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="pb-6 text-2xl font-semibold">Design system</h1>
        <ColorsSection />
        <TypographySection />
        <RadiusShadowSection />
        <TokensSection />
        <IconsSection />
        <BadgesSection />
        <ButtonsSection />
        <FieldsSection />
        <OverlaysSection />
        <DialogsSection />
        <FeedbackSection />
        <LayoutSection />
        <NavigationSection />
        <DataDisplaySection />
        <TablesSection />
        <CardsSection />
        <StatusesSection />
        <BannersSection />
        <FiltersSection />
        <FormCompositesSection />
        <MediaSection />
        <GridCellsSection />
      </div>
    </div>
  )
}
