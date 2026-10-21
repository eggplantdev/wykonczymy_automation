/* eslint-disable local/no-hand-rolled-ui -- audit page renders verbatim copies of hand-rolled markup */
'use client'

import { FileText, RotateCw, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { Field, FieldLabel } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { SELECT_TRIGGER_CLASS } from '@/components/ui/select'
import { UploadButton } from '@/components/ui/upload-button'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const noop = () => {}

const THUMBNAILS = [
  { id: 'kartka-1', isFailed: false },
  { id: 'kartka-2', isFailed: true },
  { id: 'kartka-3', isFailed: false },
]

export function A38UploadZoneGroup() {
  return (
    <AuditGroup
      id="A38"
      title="Strefa uploadu plików"
      count="11 wystąpień w 10 plikach · 9 wersji"
      drift={[
        'Wysokość strefy: domyślna (jedna linia) w formularzach, h-28 flex-col w dialogach wydatku, skanu i uploadu, h-20 flex-col w Telmaku, fieldClassName="w-fit" w inwestycji.',
        'accept: jawne image/*,application/pdf (edycja transakcji, FV), image/* (skan), application/pdf (Telmak), domyślne z FileInput w pozostałych (inspekcja, inwestycja, wydatek, upload).',
        'Limit plików: Description size="xs" z podpowiedzią i błędem role="alert" (wydatek) vs sam Description tone="error" w rozmiarze sm, bez podpowiedzi (skan); reszta bez limitu na ekranie.',
        'Podgląd wybranych plików: miniatury grid-cols-4 tylko w skanie; w FV zamiast strefy pojawia się MediaPreviewButton, a w edycji transakcji MediaPreviewButton stoi nad strefą.',
        'Dwa miejsca omijają FileInput: ukryty input sr-only + przycisk-wyzwalacz (FV po dodaniu pliku, „Wygeneruj z paragonów” jako strefa upuszczania na Button ai); inwestycja otwiera osobny dialog przez UploadButton.',
      ]}
      proposal={
        <>
          <code>FileInput</code> z propem <code>size=&quot;inline&quot; | &quot;zone&quot;</code>{' '}
          (zone = obecne <code>h-28 flex-col</code>) i <code>limit?</code>, który sam renderuje
          podpowiedź i błąd w jednym stylu; ukryte <code>input sr-only</code> zastąpić{' '}
          <code>FileInput</code> z <code>trigger</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="FileInput z etykietą, domyślna wysokość (tu: edycja transakcji w div space-y-2; inspekcja bez accept; FV z fieldClassName)"
        sources={[
          'src/components/forms/edit-transfer-form/edit-transfer-form.tsx:237',
          'src/components/forms/inspection-form/inspection-form.tsx:225',
          'src/components/forms/expense-form/line-item-invoice-field.tsx:39',
        ]}
      >
        <div className="w-full max-w-sm space-y-2">
          <FileInput label="Dodaj faktury" accept="image/*,application/pdf" multiple />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="FileInput h-28 flex-col z etykietą + Description xs z limitem (błąd: tone error, withIcon, role alert)"
        sources={['src/components/worker-expenses/expense-draft-dialog.tsx:176']}
      >
        <div className="flex w-full max-w-sm flex-col gap-2">
          <FileInput label="Zdjęcie paragonu lub faktury" multiple className="h-28 flex-col" />
          <Description size="xs">Zdjęcia lub PDF, max 10 jednocześnie.</Description>
          <Description size="xs" tone="error" withIcon role="alert">
            Najwyżej 10 zdjęć w jednym wydatku — wyślij resztę osobno.
          </Description>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="FileInput h-28 flex-col, accept image/*, błąd jako Description tone error (rozmiar sm), miniatury ul grid-cols-4 z „Ponów” na nieudanym (w źródle next/image z blob URL — tu szare kwadraty)"
        sources={[
          'src/components/worker-reports/scan-report-dialog.tsx:189',
          'src/components/worker-reports/scan-report-dialog.tsx:204',
        ]}
      >
        <div className="flex w-full max-w-sm flex-col gap-2">
          <FileInput label="Zdjęcia kartki" accept="image/*" multiple className="h-28 flex-col" />
          <Description tone="error">Maksymalnie 12 zdjęć na jedno zgłoszenie.</Description>
          <ul className="grid grid-cols-4 gap-2">
            {THUMBNAILS.map((thumbnail) => (
              <li key={thumbnail.id} className="relative">
                <div
                  className={cn(
                    'bg-muted aspect-square w-full rounded-md border object-cover',
                    thumbnail.isFailed && 'border-destructive',
                  )}
                />
                {thumbnail.isFailed && (
                  <Button size="sm" variant="destructive" className="absolute inset-x-1 bottom-1">
                    <RotateCw />
                    Ponów
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="goły FileInput h-28 flex-col, bez etykiety i accept (dialog uploadu)"
        sources={['src/components/dialogs/media-upload-dialog.tsx:58']}
      >
        <div className="w-full max-w-sm">
          <FileInput multiple onChange={noop} className="h-28 flex-col" />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="FileInput h-20 flex-col z własnym placeholderem, accept application/pdf (Telmak)"
        sources={['src/components/telmak-check/telmak-check-dialog.tsx:172']}
      >
        <div className="w-full max-w-sm">
          <FileInput
            multiple
            accept="application/pdf"
            placeholder="Wrzuć paczkę faktur PDF"
            className="h-20 flex-col"
            onChange={noop}
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="FileInput fieldClassName w-fit, bez etykiety (formularz inwestycji)"
        sources={['src/components/forms/investment-form/investment-form.tsx:172']}
      >
        <FileInput fieldClassName="w-fit" multiple />
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="ukryty input sr-only + FieldLabel „FV” + wyzwalacz w stylu selecta (MediaPreviewButton po dodaniu pliku; kopia markupu)"
        sources={['src/components/forms/expense-form/line-item-invoice-field.tsx:66']}
      >
        <div className="flex w-full max-w-sm flex-col gap-1">
          <FieldLabel>FV</FieldLabel>
          <button
            type="button"
            data-size="default"
            className={cn(
              SELECT_TRIGGER_CLASS,
              'text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/50 min-w-0 cursor-pointer justify-start',
            )}
          >
            <FileText />
            <span className="truncate">faktura-2026-10.pdf</span>
          </button>
          <input type="file" accept="image/*,application/pdf" multiple className="sr-only" />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="ukryty input sr-only + Button ai jako strefa upuszczania „Wygeneruj z paragonów” (przycisk w wierszu poniżej)"
        sources={[
          'src/components/forms/expense-form/line-items-field.tsx:390',
          'src/components/forms/expense-form/line-items-field.tsx:416',
        ]}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" accept="image/*,application/pdf" multiple className="sr-only" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ai" size="sm">
              <WandSparkles className="text-neon-cyan" />
              <span className="text-neon-cyan font-semibold">Wygeneruj z paragonów</span>
            </Button>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="UploadButton w-fit! w Field, otwiera osobny dialog uploadu (pliki inwestycji)"
        sources={['src/components/forms/investment-form/investment-assets-field.tsx:18']}
      >
        <Field>
          <UploadButton
            label="Dodaj zdjęcia lub pliki"
            isUploading={false}
            className="w-fit!"
            onClick={noop}
          />
        </Field>
      </AuditVariant>
    </AuditGroup>
  )
}
