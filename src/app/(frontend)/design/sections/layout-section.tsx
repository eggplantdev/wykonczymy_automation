'use client'

import type { ComponentProps } from 'react'
import { ChevronRight, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { Panel, BORDERED_LIST_CLASS } from '@/components/ui/panel'
import {
  EYEBROW_CLASS,
  SectionHeader,
  SUBSECTION_TITLE_CLASS,
} from '@/components/ui/section-header'
import { cn } from '@/lib/utils/cn'
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
import { Description } from '@/components/ui/description'

type CollapsibleSizeT = NonNullable<ComponentProps<typeof CollapsibleSection>['size']>
type InfoListLayoutT = NonNullable<ComponentProps<typeof InfoList>['layout']>
type SectionHeaderSizeT = NonNullable<ComponentProps<typeof SectionHeader>['size']>
type PanelToneT = NonNullable<ComponentProps<typeof Panel>['tone']>
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

const SECTION_HEADER_SIZES = Object.keys({
  lg: true,
  md: true,
  sm: true,
} satisfies Record<SectionHeaderSizeT, true>) as SectionHeaderSizeT[]

const PANEL_TONES = Object.keys({
  plain: true,
  muted: true,
  alert: true,
} satisfies Record<PanelToneT, true>) as PanelToneT[]

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
      <ShowcaseRow
        title="SectionHeader — rozmiar"
        source="ui/section-header.tsx"
        className="flex-col items-start"
      >
        {SECTION_HEADER_SIZES.map((size) => (
          <SectionHeader key={size} size={size} title={`size=${size}`} />
        ))}
        <p className={SUBSECTION_TITLE_CLASS}>SUBSECTION_TITLE_CLASS</p>
        <p className={EYEBROW_CLASS}>EYEBROW_CLASS</p>
      </ShowcaseRow>
      <ShowcaseRow title="Panel + BORDERED_LIST_CLASS" source="ui/panel.tsx">
        {PANEL_TONES.map((tone) => (
          <Panel key={tone} tone={tone} className="p-3 text-sm">
            tone={tone}
          </Panel>
        ))}
        <ul className={cn(BORDERED_LIST_CLASS, 'w-full max-w-xs text-sm')}>
          <li className="p-2">Pierwszy</li>
          <li className="p-2">Drugi</li>
        </ul>
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
            <Description withIcon={false} className="pt-2">
              Treść karty.
            </Description>
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
              <Description withIcon={false}>Zawartość sekcji.</Description>
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
