import Link from 'next/link'
import { History, Lock, TriangleAlert } from 'lucide-react'
import { Description } from '@/components/ui/description'
import { TextLink } from '@/components/ui/text-link'
import { WarningBanner } from '@/components/ui/warning-banner'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A10StripBannerGroup() {
  return (
    <AuditGroup
      id="A10"
      title="Pasek pod nagłówkiem"
      count="4 wystąpienia w 4 plikach · 4 wersje"
      drift={[
        'baza: Description (×2) vs surowy <div> vs surowy <p>',
        'tło: brak / bg-muted/50 (×2) / bg-warning/10; ramka border-border vs border-warning',
        'tekst: text-sm (Description domyślnie i historia) vs text-xs; font-semibold tylko w szablonie',
        'ikona: brak / Lock (1rem z Description) / History size-4 / TriangleAlert size-3.5',
        'margines boczny: px-4 vs px-4 sm:px-5 (tylko historia)',
      ]}
      proposal={
        <>
          Jeden pasek <code>StripBanner</code> w <code>ui/</code>:{' '}
          <code>border-b px-4 py-2 text-xs</code>, <code>role=&quot;status&quot;</code>, props{' '}
          <code>tone: &apos;muted&apos; | &apos;warning&apos;</code> i <code>icon?</code>.{' '}
          <code>WarningBanner</code> to zaokrąglone pudełko w kolorze błędu — nie pasuje do paska na
          całą szerokość.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="Description tone=warning, bez tła i ikony, text-sm"
        sources={['src/components/kosztorys/worker-report/report-grid.tsx:119']}
      >
        <div className="flex w-full flex-col">
          <Description tone="warning" withIcon={false} className="border-border border-b px-4 py-2">
            2 prace ze szkicu zniknęły z rozpiski.
          </Description>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="Description size=xs + ikona Lock, tło bg-muted/50"
        sources={['src/components/kosztorys/editor/kosztorys-locked-banner.tsx:14']}
      >
        <div className="flex w-full flex-col">
          <Description
            role="status"
            icon={Lock}
            size="xs"
            className="bg-muted/50 border-border shrink-0 items-center gap-2 border-b px-4 py-2"
          >
            Inwestycja jest zakończona — kosztorys jest tylko do odczytu.
          </Description>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="surowy <div>, text-sm, sm:px-5, ikona History size-4 (bez zwijanej listy zmian)"
        sources={['src/components/kosztorys/editor/history/history-banner.tsx:23']}
      >
        <div className="flex w-full flex-col">
          <div
            role="status"
            className="bg-muted/50 border-border flex shrink-0 flex-col gap-1 border-b px-4 py-2 text-sm sm:px-5"
          >
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <History className="size-4 shrink-0" aria-hidden />
              <span className="font-medium">Wersja z 2026-10-20</span>
              <span className="text-muted-foreground">— porównanie z bieżącą ·</span>
              <TextLink asChild className="font-medium">
                <Link href="/design/audyt">Wróć do bieżącej</Link>
              </TextLink>
            </p>
            <p className="text-muted-foreground">Bez różnic względem bieżącej</p>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="surowy <p>, paleta warning, text-xs font-semibold, TriangleAlert size-3.5"
        sources={['src/components/kosztorys/editor/template-catalogue-banner.tsx:5']}
      >
        <div className="flex w-full flex-col">
          <p
            role="status"
            className="border-warning bg-warning/10 text-warning flex shrink-0 items-center gap-2 border-b px-4 py-2 text-xs font-semibold"
          >
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            <span>Pozycje szablonu to wpisy z katalogu prac.</span>
          </p>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="W"
        label="wzorzec: WarningBanner (ui/)"
        sources={['src/components/kosztorys/summary/settings/zero-vat-warning.tsx:5']}
      >
        <WarningBanner>Stawka VAT 0% — sprawdź ustawienia inwestycji.</WarningBanner>
      </AuditVariant>
    </AuditGroup>
  )
}
