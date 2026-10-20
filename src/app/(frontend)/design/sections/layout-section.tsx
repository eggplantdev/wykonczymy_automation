'use client'

import type { ComponentProps } from 'react'
import { ChevronRight, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SectionHeader } from '@/components/ui/section-header'
import { SettingsCard } from '@/components/ui/settings-card'
import { CollapsibleSection, OPEN_STATES } from '@/components/ui/collapsible-section'
import { Separator } from '@/components/ui/separator'
import { ControlGrid } from '@/components/ui/control-grid'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { InfoList } from '@/components/ui/info-list'
import { EdgeHandlePill } from '@/components/ui/edge-handle-pill'
import { AuthPageLayout } from '@/components/ui/auth-page-layout'
import { AuthSuccessCard } from '@/components/ui/auth-success-card'
import { Input } from '@/components/ui/input'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

type CollapsibleSizeT = NonNullable<ComponentProps<typeof CollapsibleSection>['size']>
type InfoListLayoutT = NonNullable<ComponentProps<typeof InfoList>['layout']>
type EdgeHandleOrientationT = ComponentProps<typeof EdgeHandlePill>['orientation']

const COLLAPSIBLE_SIZES = Object.keys({
  lg: true,
  sm: true,
  compact: true,
} satisfies Record<CollapsibleSizeT, true>) as CollapsibleSizeT[]

const INFO_LIST_LAYOUTS = Object.keys({
  inline: true,
  stacked: true,
} satisfies Record<InfoListLayoutT, true>) as InfoListLayoutT[]

const EDGE_HANDLE_ORIENTATIONS = Object.keys({
  vertical: true,
  horizontal: true,
} satisfies Record<EdgeHandleOrientationT, true>) as EdgeHandleOrientationT[]

const INFO_ITEMS = [
  { label: 'Inwestycja', value: 'Mieszkanie Mokotów' },
  { label: 'Kierownik', value: 'Jan Kowalski' },
  { label: 'Telefon', value: '' },
]

const SUMMARY_COLS = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`

export function LayoutSection() {
  return (
    <ShowcaseSection id="layout">
      <ShowcaseRow
        title="PageWrapper + SectionHeader"
        source="ui/page-wrapper.tsx, ui/section-header.tsx"
      >
        <div className="w-full rounded-md border">
          <PageWrapper title="Tytuł strony" description="Opis strony">
            <SectionHeader title="Nagłówek sekcji" />
          </PageWrapper>
        </div>
      </ShowcaseRow>
      <ShowcaseRow title="SettingsCard" source="ui/settings-card.tsx">
        <div className="w-full max-w-md">
          <SettingsCard
            icon={Settings}
            title="Ustawienia"
            action={
              <Button size="xs" variant="outline">
                Akcja
              </Button>
            }
          >
            <p className="text-muted-foreground pt-2 text-sm">Treść karty.</p>
          </SettingsCard>
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="CollapsibleSection — rozmiar × stan"
        source="ui/collapsible-section.tsx"
        className="grid sm:grid-cols-2"
      >
        {COLLAPSIBLE_SIZES.flatMap((size) =>
          OPEN_STATES.map((state) => (
            <CollapsibleSection
              key={`${size}-${state}`}
              title={`size=${size}, ${state}`}
              size={size}
              defaultOpen={state === 'open'}
              hint="Podpowiedź"
            >
              <p className="text-muted-foreground text-sm">Zawartość sekcji.</p>
            </CollapsibleSection>
          )),
        )}
      </ShowcaseRow>
      <ShowcaseRow title="Separator" source="ui/separator.tsx">
        <span className="text-sm">A</span>
        <Separator />
        <span className="text-sm">B</span>
        <Separator orientation="horizontal" className="my-2" />
      </ShowcaseRow>
      <ShowcaseRow title="ControlGrid" source="ui/control-grid.tsx">
        <ControlGrid>
          <Button variant="outline" size="sm">
            Filtr 1
          </Button>
          <Button variant="outline" size="sm">
            Filtr 2
          </Button>
          <Button variant="outline" size="sm">
            Filtr 3
          </Button>
        </ControlGrid>
      </ShowcaseRow>
      <ShowcaseRow title="SummaryTable" source="ui/summary-grid.tsx">
        <SummaryTable cols={SUMMARY_COLS} className="w-fit">
          <SummaryHeaderCell variant="label">Pozycja</SummaryHeaderCell>
          <SummaryHeaderCell>Kwota</SummaryHeaderCell>
          <SummaryLabelCell>Robocizna</SummaryLabelCell>
          <SummaryValueCell tone="success">8 000,00 zł</SummaryValueCell>
          <SummaryLabelCell muted>Wyszarzone</SummaryLabelCell>
          <SummaryValueCell muted>0,00 zł</SummaryValueCell>
          <SummaryLabelCell hints={[{ variant: 'noStages' }]}>Z podpowiedzią</SummaryLabelCell>
          <SummaryValueCell tone="error" note={{ text: 'Notatka', tone: 'error' }}>
            -120,00 zł
          </SummaryValueCell>
          <SummaryLabelCell weight="bold">Razem</SummaryLabelCell>
          <SummaryValueCell weight="bold">7 880,00 zł</SummaryValueCell>
        </SummaryTable>
      </ShowcaseRow>
      <ShowcaseRow
        title="InfoList — układy"
        source="ui/info-list.tsx"
        className="grid sm:grid-cols-2"
      >
        {INFO_LIST_LAYOUTS.map((layout) => (
          <InfoList key={layout} items={INFO_ITEMS} layout={layout} />
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="EdgeHandlePill (najedź)" source="ui/edge-handle-pill.tsx">
        {EDGE_HANDLE_ORIENTATIONS.map((orientation) => (
          <span
            key={orientation}
            className="group flex size-28 items-center justify-center rounded-md border"
          >
            <EdgeHandlePill orientation={orientation}>
              <ChevronRight className="size-3" />
            </EdgeHandlePill>
          </span>
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="AuthPageLayout + AuthSuccessCard (w ramce)"
        source="ui/auth-page-layout.tsx, ui/auth-success-card.tsx"
        className="grid sm:grid-cols-2"
      >
        <div className="flex justify-center rounded-md border py-6">
          <AuthPageLayout title="Zaloguj się" description="Podaj e-mail i hasło.">
            <Input placeholder="E-mail" />
          </AuthPageLayout>
        </div>
        <div className="flex justify-center rounded-md border py-6">
          <AuthPageLayout title="Gotowe">
            <AuthSuccessCard message="Hasło zostało zmienione." />
          </AuthPageLayout>
        </div>
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
