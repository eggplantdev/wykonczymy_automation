'use client'

import { useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { InlineLoading, BlockLoading } from '@/components/ui/loader/inline-loading'
import { Loader } from '@/components/ui/loader/loader'
import { FixedClientLoader } from '@/components/ui/loader/fixed-client-loader'
import {
  ContentLoading,
  DetailPageLoading,
  OverlayLoading,
  PageLoading,
  TitledPageLoading,
} from '@/components/ui/loader/page-loading'
import { EmptyState } from '@/components/ui/empty-state'
import { WarningBanner } from '@/components/ui/warning-banner'
import { Description } from '@/components/ui/description'
import { AlertIcon } from '@/components/ui/alert-icon'
import { LabelHintIcon, type LabelHintT } from '@/components/ui/label-hint-icon'
import { AuthSubmitButton } from '@/components/ui/auth-submit-button'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

type DescriptionSizeT = NonNullable<ComponentProps<typeof Description>['size']>
type DescriptionToneT = NonNullable<ComponentProps<typeof Description>['tone']>
type LabelHintSizeT = NonNullable<ComponentProps<typeof LabelHintIcon>['size']>

const DESCRIPTION_SIZES = Object.keys({
  sm: true,
  xs: true,
  '2xs': true,
} satisfies Record<DescriptionSizeT, true>) as DescriptionSizeT[]

const DESCRIPTION_TONES = Object.keys({
  muted: true,
  error: true,
  warning: true,
} satisfies Record<DescriptionToneT, true>) as DescriptionToneT[]

const LABEL_HINTS = Object.values({
  mismatch: { variant: 'mismatch', content: 'Przykładowa niezgodność' },
  planeUnconfirmed: { variant: 'planeUnconfirmed', content: 'Przykładowe niepotwierdzenie' },
  strandedDeposits: { variant: 'strandedDeposits', content: 'Przykładowe wpłaty' },
  noStages: { variant: 'noStages' },
  splitScaled: { variant: 'splitScaled' },
} satisfies { [K in LabelHintT['variant']]: Extract<LabelHintT, { variant: K }> }) as LabelHintT[]

const LABEL_HINT_SIZES = Object.keys({
  sm: true,
  md: true,
  lg: true,
} satisfies Record<LabelHintSizeT, true>) as LabelHintSizeT[]

const STAT_ROWS = [
  [
    {
      label: 'Robocizna',
      value: '8 000,00 zł',
      amount: 8000,
      borderClassName: 'border-chart-turquoise',
    },
    {
      label: 'Materiały',
      value: '-4 345,00 zł',
      amount: -4345,
      borderClassName: 'border-chart-orange',
    },
  ],
  [{ label: 'Rabat', value: '-500,00 zł', amount: -500, borderClassName: 'border-chart-purple' }],
]

const FIXED_LOADER_MS = 1500

export function FeedbackSection() {
  const [isFixedLoaderShown, setIsFixedLoaderShown] = useState(false)

  function showFixedLoader() {
    setIsFixedLoaderShown(true)
    setTimeout(() => setIsFixedLoaderShown(false), FIXED_LOADER_MS)
  }

  return (
    <ShowcaseSection id="feedback">
      <ShowcaseRow title="Spinnery" source="ui/gradient-spinner.tsx, ui/loader/page-loading.tsx">
        <GradientSpinner />
        <GradientSpinner className="size-8" />
        <ContentLoading />
      </ShowcaseRow>
      <ShowcaseRow
        title="InlineLoading, BlockLoading"
        source="ui/loader/inline-loading.tsx"
        className="grid sm:grid-cols-2"
      >
        <InlineLoading />
        <InlineLoading label="Pobieranie faktury…" />
        <div className="rounded-md border">
          <BlockLoading />
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="Ekrany ładowania (w ramce)"
        source="ui/loader/page-loading.tsx"
        className="grid sm:grid-cols-3"
      >
        <div className="flex h-48 flex-col rounded-md border">
          <PageLoading />
        </div>
        <div className="flex h-48 flex-col overflow-hidden rounded-md border">
          <TitledPageLoading title="Tytuł strony" />
        </div>
        <div className="flex h-48 flex-col overflow-hidden rounded-md border">
          <DetailPageLoading />
        </div>
        <div className="relative h-48 rounded-md border p-4">
          <p className="text-sm">OverlayLoading nad treścią</p>
          <OverlayLoading />
        </div>
      </ShowcaseRow>
      <ShowcaseRow title="Loader" source="ui/loader/loader.tsx, ui/loader/fixed-client-loader.tsx">
        <div className="relative h-32 w-64 rounded-md border">
          <Loader loading portal={false} className="absolute z-0" />
        </div>
        <div className="relative h-32 w-64 rounded-md border">
          <Loader
            loading
            portal={false}
            className="absolute z-0"
            loaderComponent={<GradientSpinner className="size-8" />}
          />
        </div>
        <Button variant="outline" size="sm" onClick={showFixedLoader}>
          Loader w portalu ({FIXED_LOADER_MS} ms)
        </Button>
        {isFixedLoaderShown && <Loader loading portal />}
        {isFixedLoaderShown && (
          <FixedClientLoader>
            <p className="bg-popover fixed top-4 left-1/2 z-100000000 -translate-x-1/2 rounded-md border px-3 py-1 text-xs">
              FixedClientLoader
            </p>
          </FixedClientLoader>
        )}
      </ShowcaseRow>
      <ShowcaseRow title="EmptyState" source="ui/empty-state.tsx">
        <div className="w-full rounded-md border">
          <EmptyState title="Brak transakcji" description="Dodaj pierwszą transakcję.">
            <Button size="sm">Dodaj</Button>
          </EmptyState>
        </div>
      </ShowcaseRow>
      <ShowcaseRow title="EmptyState — size=inline" source="ui/empty-state.tsx">
        <div className="w-full rounded-md border">
          <EmptyState size="inline" title="Brak zapisanych wersji." />
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="Ostrzeżenia"
        source="ui/warning-banner.tsx, ui/alert-icon.tsx, ui/label-hint-icon.tsx"
      >
        <WarningBanner className="px-2">Kwoty nie zgadzają się z kosztorysem.</WarningBanner>
        <AlertIcon />
        {LABEL_HINTS.map((hint) => (
          <LabelHintIcon key={hint.variant} {...hint} size="md" />
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="LabelHintIcon — rozmiary" source="ui/label-hint-icon.tsx size">
        {LABEL_HINT_SIZES.map((size) => (
          <span key={size} className="flex items-center gap-1 text-sm">
            <code className="text-muted-foreground text-xs">{size}</code>
            <LabelHintIcon {...LABEL_HINTS[0]} size={size} />
          </span>
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="AuthSubmitButton — sukces"
        source="ui/auth-submit-button.tsx isSuccess, successText"
      >
        <div className="w-48">
          <AuthSubmitButton
            isPending={false}
            isSuccess
            idleText="Zapisz"
            pendingText="Zapisywanie…"
            successText="Zapisano"
          />
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="ToggleStatButtons — etykiety wierszy i podpowiedzi"
        source="ui/toggle-stat-buttons.tsx rowLabels, rowTooltips, summaryTooltip, helpText"
        className="flex-col items-stretch"
      >
        <ToggleStatButtons
          rows={STAT_ROWS}
          rowLabels={['Koszty', 'Korekty']}
          rowTooltips={['Przykładowa podpowiedź wiersza', undefined]}
          summaryLabel="Razem"
          summaryTooltip="Suma widocznych kafli"
          helpText="Kliknij kafel, aby wyłączyć go z sumy."
          colorValues
        />
      </ShowcaseRow>
      <ShowcaseRow
        title="Description — rozmiar × ton"
        source="ui/description.tsx"
        className="grid sm:grid-cols-2"
      >
        {DESCRIPTION_TONES.flatMap((tone) =>
          DESCRIPTION_SIZES.map((size) => (
            <Description key={`${tone}-${size}`} tone={tone} size={size}>
              tone={tone} size={size}
            </Description>
          )),
        )}
        <Description withIcon={false}>withIcon=false</Description>
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
