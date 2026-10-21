/* eslint-disable local/no-hand-rolled-ui -- audit page renders verbatim copies of hand-rolled markup */
'use client'

import { Minus, Plus, Scan, Search, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Description } from '@/components/ui/description'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const OVERLAY_BUTTON =
  'bg-background/85 text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-full border shadow-sm'

const ZOOM_ACTIONS = [
  { icon: Minus, label: 'Pomniejsz' },
  { icon: Plus, label: 'Powiększ' },
  { icon: Scan, label: 'Dopasuj do okna' },
]

export function A29OverlaySurfaceGroup() {
  return (
    <AuditGroup
      id="A29"
      title="Kontrolki nad zdjęciem"
      count="5 wystąpień w 2 plikach · 5 wersji"
      drift={[
        'zaokrąglenie: rounded-full (okrągłe przyciski miniatury) vs rounded-md (komunikat, pasek zoomu) vs domyślne checkboxa',
        'border shadow-sm na wszystkich poza checkboxem, który ma samo tło bg-background/85',
        'wnętrze: ręczny <button> size-7 vs RowActionButton size-8 w pasku z p-1 vs Description z px-3 py-1',
        'przycisk usuwania różni się od podglądu tylko hoverem (hover:text-destructive)',
      ]}
      proposal={
        <>
          Stała <code>OVERLAY_SURFACE_CLASS</code> w <code>ui/</code> (
          <code>bg-background/85 border shadow-sm</code>) albo komponent <code>OverlaySurface</code>{' '}
          (props: <code>shape?: &apos;round&apos; | &apos;rounded&apos;</code>) dla wszystkiego, co
          pływa nad zdjęciem.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="okrągły przycisk podglądu (OVERLAY_BUTTON) w rogu miniatury"
        sources={['src/components/media/media-strip.tsx:110']}
      >
        <div className="bg-muted relative h-24 w-full rounded-md">
          <div className="absolute top-1 right-1 flex gap-1">
            <SimpleTooltip content="Podgląd">
              <button type="button" aria-label="Podgląd: faktura.jpg" className={OVERLAY_BUTTON}>
                <Search className="size-3.5" />
              </button>
            </SimpleTooltip>
          </div>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="b"
        label="okrągły przycisk usuwania — jak a + hover:text-destructive"
        sources={['src/components/media/media-strip.tsx:124']}
      >
        <div className="bg-muted relative h-24 w-full rounded-md">
          <div className="absolute top-1 right-1 flex gap-1">
            <SimpleTooltip content="Usuń plik">
              <button
                type="button"
                aria-label="Usuń plik"
                className={cn(OVERLAY_BUTTON, 'hover:text-destructive')}
              >
                <Trash2 className="size-3.5" />
              </button>
            </SimpleTooltip>
          </div>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="c"
        label="checkbox wyboru: samo bg-background/85, bez border-u i cienia z powierzchni"
        sources={['src/components/media/media-strip.tsx:91']}
      >
        <div className="bg-muted relative h-24 w-full rounded-md">
          <SimpleTooltip content="Wybierz">
            <span className="absolute top-1 left-1">
              <Checkbox
                checked={false}
                aria-label="Wybierz: faktura.jpg"
                className="bg-background/85 size-5"
              />
            </span>
          </SimpleTooltip>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="d"
        label="komunikat na środku u góry: Description rounded-md border px-3 py-1 shadow-sm"
        sources={['src/components/media/zoomable-preview-image.tsx:93']}
      >
        <div className="bg-muted relative h-24 w-full rounded-md">
          <Description
            withIcon={false}
            className="bg-background/85 absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-md border px-3 py-1 shadow-sm"
          >
            Nie udało się wczytać oryginału
          </Description>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="e"
        label="pasek zoomu w prawym dolnym rogu: rounded-md border p-1 shadow-sm + RowActionButton size-8"
        sources={['src/components/media/zoomable-preview-image.tsx:101']}
      >
        <div className="bg-muted relative h-24 w-full rounded-md">
          <div className="bg-background/85 absolute right-2 bottom-2 z-10 flex gap-1 rounded-md border p-1 shadow-sm">
            {ZOOM_ACTIONS.map(({ icon, label }) => (
              <RowActionButton key={label} icon={icon} label={label} className="size-8" />
            ))}
          </div>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
