'use client'

import { useState } from 'react'
import type { VariantProps } from 'class-variance-authority'
import { Plus, Trash2 } from 'lucide-react'
import { Button, buttonVariants, BUTTON_ANIMATION_CLASSES } from '@/components/ui/button'
import { RemoveButton } from '@/components/ui/remove-button'
import { UploadButton } from '@/components/ui/upload-button'
import { SaveAsDefaultButton } from '@/components/ui/save-as-default-button'
import { SubmitPill } from '@/components/ui/submit-pill'
import { ToolbarToggle } from '@/components/ui/toolbar-toggle'
import { StatButton } from '@/components/ui/stat-button'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import { HistoryBackButton } from '@/components/ui/history-back-button'
import { ExternalLink } from '@/components/ui/external-link'
import { AuthSubmitButton } from '@/components/ui/auth-submit-button'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

type ButtonVariantsT = VariantProps<typeof buttonVariants>
type ButtonVariantT = NonNullable<ButtonVariantsT['variant']>
type ButtonSizeT = NonNullable<ButtonVariantsT['size']>
type ButtonAlignT = NonNullable<ButtonVariantsT['align']>

const VARIANTS = Object.keys({
  default: true,
  defaultOutline: true,
  secondary: true,
  outline: true,
  ghost: true,
  ghostDestructive: true,
  outlineDestructive: true,
  destructive: true,
  destructiveOutline: true,
  link: true,
  activeFilter: true,
  green: true,
  greenOutline: true,
  red: true,
  redOutline: true,
  blue: true,
  blueOutline: true,
  teal: true,
  tealOutline: true,
  turquoise: true,
  turquoiseOutline: true,
  ai: true,
} satisfies Record<ButtonVariantT, true>) as ButtonVariantT[]

const SIZES = Object.keys({
  xs: true,
  sm: true,
  default: true,
  lg: true,
  icon: true,
  iconLg: true,
} satisfies Record<ButtonSizeT, true>) as ButtonSizeT[]

const ALIGNS = Object.keys({ center: true, start: true } satisfies Record<ButtonAlignT, true>) as ButtonAlignT[]

const ANIMATIONS = Object.keys(BUTTON_ANIMATION_CLASSES) as (keyof typeof BUTTON_ANIMATION_CLASSES)[]

const VIEW_OPTIONS = [
  { value: 'list', label: 'Lista' },
  { value: 'grid', label: 'Siatka' },
] as const

function isIconSize(size: ButtonSizeT) {
  return size === 'icon' || size === 'iconLg'
}

export function ButtonsSection() {
  const [view, setView] = useState<(typeof VIEW_OPTIONS)[number]['value']>('list')
  const [defaultId, setDefaultId] = useState<string | undefined>(undefined)
  const [isPillShown, setIsPillShown] = useState(false)

  return (
    <ShowcaseSection id="buttons">
      <ShowcaseRow title="Button — wariant × rozmiar" source="ui/button.tsx buttonVariants">
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-2">
            <thead>
              <tr>
                <th />
                {SIZES.map((size) => (
                  <th key={size} className="text-muted-foreground text-left text-xs font-normal">
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VARIANTS.map((variant) => (
                <tr key={variant}>
                  <td className="text-muted-foreground pr-2 font-mono text-xs">{variant}</td>
                  {SIZES.map((size) => (
                    <td key={size}>
                      <Button variant={variant} size={size} aria-label={variant}>
                        {isIconSize(size) ? <Plus /> : 'Zapisz'}
                      </Button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ShowcaseRow>
      <ShowcaseRow title="Button — disabled" source="ui/button.tsx">
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant} size="sm" disabled>
            {variant}
          </Button>
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="Button — align, ikona + etykieta, animacje" source="ui/button.tsx">
        {ALIGNS.map((align) => (
          <Button key={align} variant="outline" align={align} className="w-48">
            align={align}
          </Button>
        ))}
        <Button variant="outline">
          <Plus />
          Dodaj
        </Button>
        <Button variant="destructive">
          <Trash2 />
          Usuń
        </Button>
        {ANIMATIONS.map((animation) => (
          <Button key={animation} variant="ai" animations={[animation]}>
            animations=[{animation}]
          </Button>
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="Akcje wiersza" source="ui/row-actions/*">
        <EditButton onClick={() => undefined} />
        <EditButton onClick={() => undefined} showLabel />
        <DeleteButton onClick={() => undefined} />
        <DeleteButton onClick={() => undefined} showLabel />
        <RowActionButton icon={Plus} label="Dodaj" tooltip="Dodaj pozycję" onClick={() => undefined} />
        <RemoveButton onClick={() => undefined} aria-label="Usuń" />
      </ShowcaseRow>
      <ShowcaseRow title="Przyciski z zachowaniem" source="ui/upload-button.tsx, save-as-default-button.tsx, auth-submit-button.tsx">
        <UploadButton label="Wgraj plik" isUploading={false} onClick={() => undefined} />
        <UploadButton label="Wgraj plik" isUploading onClick={() => undefined} />
        <SaveAsDefaultButton
          selectedId="a"
          defaultId={defaultId}
          onSave={async (selectedId) => {
            setDefaultId(selectedId)
            return { success: true }
          }}
          labels={{ isDefault: 'Domyślny', save: 'Ustaw jako domyślny', saved: 'Zapisano' }}
        />
        <div className="w-48">
          <AuthSubmitButton isPending={false} idleText="Zaloguj" pendingText="Logowanie…" />
        </div>
        <div className="w-48">
          <AuthSubmitButton isPending idleText="Zaloguj" pendingText="Logowanie…" />
        </div>
      </ShowcaseRow>
      <ShowcaseRow title="SubmitPill (fixed, portal)" source="ui/submit-pill.tsx">
        <Button variant="outline" size="sm" onClick={() => setIsPillShown((shown) => !shown)}>
          {isPillShown ? 'Ukryj' : 'Pokaż'} SubmitPill
        </Button>
        {isPillShown && <SubmitPill label="Zapisywanie…" />}
      </ShowcaseRow>
      <ShowcaseRow title="ToolbarToggle" source="ui/toolbar-toggle.tsx">
        <ToolbarToggle
          legend="Widok"
          aria-label="Widok"
          options={[...VIEW_OPTIONS]}
          value={view}
          onChange={setView}
        />
      </ShowcaseRow>
      <ShowcaseRow title="Kafle statystyk — dwie implementacje" source="ui/stat-button.tsx, ui/toggle-stat-buttons.tsx">
        <StatButton label="Bilans" value="12 345,00 zł" />
        <StatButton label="Marża" value="2 100,00 zł" color="chart-green" tooltip="Przykładowa podpowiedź" />
        <ToggleStatButtons
          rows={[
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
                tooltip: 'Przykładowa podpowiedź',
              },
            ],
          ]}
          summaryLabel="Razem"
          colorValues
        />
      </ShowcaseRow>
      <ShowcaseRow title="Linki w kształcie przycisku" source="ui/history-back-button.tsx, ui/external-link.tsx">
        <HistoryBackButton fallbackHref="/" />
        <ExternalLink href="https://example.com">ExternalLink text</ExternalLink>
        <ExternalLink href="https://example.com" variant="button">
          ExternalLink button
        </ExternalLink>
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
