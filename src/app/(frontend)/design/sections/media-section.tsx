'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { MediaPreviewButton } from '@/components/media/media-preview-button'
import { MediaPreviewDialog } from '@/components/media/media-preview-dialog'
import { MediaPreviewTrigger } from '@/components/media/media-preview-trigger'
import { MediaStrip } from '@/components/media/media-strip'
import { MediaUploadDialog } from '@/components/dialogs/media-upload-dialog'
import { RegisterBalanceChart } from '@/components/cash-registers/register-balance-chart'
import { SectionSharePie } from '@/components/kosztorys/summary/charts/section-share-pie'
import { toggleInSet } from '@/lib/utils/toggle-in-set'
import { ASSET_PREVIEW_LABELS, INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'
import type { MediaFileT } from '@/types/media'
import type { CashRegisterRowT } from '@/types/table-rows'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'
import { OpenPreview } from '../open-preview'

const ZoomablePreviewImage = dynamic(
  () => import('@/components/media/zoomable-preview-image').then((m) => m.ZoomablePreviewImage),
  { ssr: false },
)

const FILES: MediaFileT[] = [
  {
    id: 1,
    url: '/logo-wykonczymy.png',
    thumbnailUrl: '/logo-wykonczymy.png',
    filename: 'zdjecie-lazienka.png',
    mimeType: 'image/png',
    kind: 'zdjecie',
  },
  {
    id: 2,
    url: '/icons/icon-512.png',
    thumbnailUrl: '/icons/icon-192.png',
    filename: 'zdjecie-kuchnia.png',
    mimeType: 'image/png',
    kind: 'zdjecie',
  },
  {
    id: 3,
    url: '/icons/icon-512.png',
    thumbnailUrl: null,
    filename: 'zdjecie-bez-miniatury.png',
    mimeType: 'image/png',
    kind: 'zdjecie',
  },
  {
    id: 4,
    url: '/robots.txt',
    thumbnailUrl: null,
    filename: 'notatka-z-budowy.txt',
    mimeType: 'text/plain',
    kind: 'inne',
  },
]

const STRIP_SIZES = '(max-width: 767.98px) 25vw, 96px'

const REGISTERS: CashRegisterRowT[] = [
  { id: 1, name: 'Kasa główna', ownerName: 'Admin', balance: 24500, type: 'MAIN', active: true },
  {
    id: 2,
    name: 'Kasa pomocnicza',
    ownerName: 'Admin',
    balance: 3200,
    type: 'AUXILIARY',
    active: true,
  },
  {
    id: 3,
    name: 'Konto wirtualne',
    ownerName: 'Admin',
    balance: -850,
    type: 'VIRTUAL',
    active: true,
  },
  {
    id: 4,
    name: 'Kasa Jana',
    ownerName: 'Jan Testowy',
    balance: 1200,
    type: 'WORKER',
    active: true,
  },
  {
    id: 5,
    name: 'Kasa Anny',
    ownerName: 'Anna Przykładowa',
    balance: 640,
    type: 'WORKER',
    active: true,
  },
]

const SECTION_SUBTOTALS: SectionSliceInputT[] = [
  {
    sectionId: 1,
    sectionName: 'Łazienka',
    sectionColor: 'blue-soft',
    plannedNet: 18000,
    net: 9500,
  },
  {
    sectionId: 2,
    sectionName: 'Kuchnia',
    sectionColor: 'teal-soft',
    plannedNet: 12000,
    net: 11800,
  },
  { sectionId: 3, sectionName: 'Salon', sectionColor: 'green-soft', plannedNet: 7000, net: 2100 },
]

function noop() {}

export function MediaSection() {
  const [files, setFiles] = useState(FILES)
  const [pickedIds, setPickedIds] = useState<Set<number>>(() => new Set([1]))
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isPlanMarked, setIsPlanMarked] = useState(false)

  const removeFile = (file: { id?: number }) =>
    setFiles((previous) => previous.filter(({ id }) => id !== file.id))
  const togglePicked = (file: MediaFileT) =>
    setPickedIds((previous) => toggleInSet(previous, file.id))

  return (
    <ShowcaseSection id="media">
      <h3 className="mt-4 text-xs font-semibold tracking-wide uppercase">A. Podgląd plików</h3>
      <ShowcaseRow
        title="MediaPreviewTrigger — field / compact / chip"
        source="media/media-preview-trigger.tsx"
      >
        <MediaPreviewTrigger label="faktura-001.pdf" ariaLabel="Podgląd" onClick={noop} />
        <MediaPreviewTrigger
          label="faktura-001.pdf"
          ariaLabel="Podgląd"
          onClick={noop}
          variant="compact"
        />
        <MediaPreviewTrigger
          label="faktura-001.pdf"
          ariaLabel="Podgląd"
          onClick={noop}
          variant="chip"
        />
      </ShowcaseRow>
      <ShowcaseRow
        title="MediaPreviewButton (trigger + dialog podglądu)"
        source="media/media-preview-button.tsx"
      >
        <MediaPreviewButton files={FILES.slice(0, 1)} labels={INVOICE_PREVIEW_LABELS} />
        <MediaPreviewButton
          files={FILES.slice(0, 2)}
          labels={ASSET_PREVIEW_LABELS}
          label="2 zdjęcia"
          variant="chip"
          onAdd={(closePreview) => closePreview()}
          onRemove={(_file, closePreview) => closePreview()}
          onRemoveAll={(closePreview) => closePreview()}
        />
        <MediaPreviewButton files={[]} labels={INVOICE_PREVIEW_LABELS} variant="compact" />
      </ShowcaseRow>
      <ShowcaseRow
        title="MediaPreviewDialog — otwarty, z akcjami i znacznikiem rzutu"
        source="media/media-preview-dialog.tsx"
      >
        <OpenPreview backdrop={false} className="h-160 justify-start">
          <MediaPreviewDialog
            files={FILES}
            labels={ASSET_PREVIEW_LABELS}
            open
            onOpenChange={noop}
            onAdd={noop}
            onRemove={noop}
            onRemoveAll={noop}
            planMarker={{
              isMarked: () => isPlanMarked,
              onMark: () => setIsPlanMarked((previous) => !previous),
              label: 'Oznacz jako rzut',
              markedLabel: 'Rzut',
            }}
          />
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow
        title="MediaStrip — podgląd po kliknięciu / tryb wyboru"
        source="media/media-strip.tsx"
        className="grid grid-cols-1 gap-4"
      >
        <MediaStrip
          files={files}
          labels={ASSET_PREVIEW_LABELS}
          sizes={STRIP_SIZES}
          gridClassName="w-full max-w-xl grid-cols-4 sm:grid-cols-6"
          onRemove={removeFile}
        />
        <MediaStrip
          files={FILES}
          labels={ASSET_PREVIEW_LABELS}
          sizes={STRIP_SIZES}
          gridClassName="w-full max-w-xl grid-cols-4 sm:grid-cols-6"
          pick={{ selectedIds: pickedIds, onToggle: togglePicked, label: 'Wybierz' }}
        />
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setFiles(FILES)}>
          Przywróć pliki
        </Button>
      </ShowcaseRow>
      <ShowcaseRow
        title="ZoomablePreviewImage (w rodzicu o stałym rozmiarze)"
        source="media/zoomable-preview-image.tsx"
      >
        <div className="relative h-64 w-full max-w-md rounded-md border">
          <ZoomablePreviewImage
            src="/logo-wykonczymy.png"
            alt="Przykładowy obraz"
            sizes="(max-width: 767.98px) calc(100vw - 2rem), 448px"
          />
        </div>
      </ShowcaseRow>
      <ShowcaseRow title="MediaUploadDialog" source="dialogs/media-upload-dialog.tsx">
        <Button variant="outline" size="sm" onClick={() => setIsUploadOpen(true)}>
          Dodaj plik
        </Button>
        <MediaUploadDialog
          title="Dodaj zdjęcie"
          open={isUploadOpen}
          onOpenChange={setIsUploadOpen}
          onFiles={noop}
          allowPlanMarker
        />
        <OpenPreview backdrop={false} className="justify-start">
          <MediaUploadDialog
            title="Dodaj zdjęcie"
            open
            onOpenChange={noop}
            onFiles={noop}
            allowPlanMarker
          />
        </OpenPreview>
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">
        B. Wykresy domenowe (na prymitywach z „Prezentacja danych")
      </h3>
      <ShowcaseRow
        title="RegisterBalanceChart (saldo wg typu kasy)"
        source="cash-registers/register-balance-chart.tsx"
        className="grid grid-cols-1"
      >
        <RegisterBalanceChart data={REGISTERS} />
      </ShowcaseRow>
      <ShowcaseRow
        title="SectionSharePie (udział sekcji, Przedmiar / Wykonane)"
        source="kosztorys/summary/charts/section-share-pie.tsx"
        className="grid grid-cols-1"
      >
        <SectionSharePie subtotals={SECTION_SUBTOTALS} />
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
