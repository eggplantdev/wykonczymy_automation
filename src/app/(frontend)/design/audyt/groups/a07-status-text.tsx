/* eslint-disable local/no-hand-rolled-ui -- audit page renders verbatim copies of hand-rolled markup */
import { AlertIcon } from '@/components/ui/alert-icon'
import { Badge } from '@/components/ui/badge'
import { HintTooltip } from '@/components/ui/tooltip'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A07StatusTextGroup() {
  return (
    <AuditGroup
      id="A07"
      title="Kolorowy tekst statusu"
      count="11 wystąpień w 9 plikach · 10 wersji"
      drift={[
        'Kolor alarmu: text-destructive albo text-warning; stan spokojny raz wyszarzony (text-muted-foreground), raz domyślny kolor tekstu.',
        'Rozmiar: text-xs, text-sm albo dziedziczony z komórki.',
        'Waga: font-medium tylko przy części statusów (telmak, duplikaty, termin, gwarancja), podpisy text-xs bez pogrubienia.',
        'Ikona ostrzeżenia tylko w dwóch miejscach i za każdym razem inaczej: AlertIcon size-4 w kolorze tekstu przez rodzica vs size-3 text-current w text-xs.',
        'Dodatki w pojedynczych kopiach: whitespace-nowrap, pl-2; trzy kopie mają eslint-disable … table-cell status colour, reszta nie.',
      ]}
      proposal={
        <>
          Prymityw <code>StatusText</code> w <code>ui/</code>:{' '}
          <code>
            tone: &apos;destructive&apos; | &apos;warning&apos; | &apos;muted&apos; |
            &apos;default&apos;
          </code>
          , <code>size?: &apos;xs&apos; | &apos;sm&apos;</code>, <code>strong?</code> (font-medium)
          i <code>withIcon?</code> (AlertIcon dopasowana do rozmiaru tekstu) — zastępuje też ręczne
          eslint-disable.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="text-xs, czerwony gdy alarm, inaczej wyszarzony"
        sources={[
          'src/components/fleet/deadline-cell.tsx:48',
          'src/components/equipment/location-cell.tsx:26',
        ]}
      >
        <span className="text-destructive text-xs">Nie wiadomo gdzie</span>
        <span className="text-muted-foreground text-xs">za 182 dni</span>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="text-xs, ostrzegawczy (warning) gdy pilne, inaczej wyszarzony"
        sources={['src/components/equipment/warranty-cell.tsx:32']}
      >
        <span className="text-warning text-xs">za 13 dni</span>
        <span className="text-muted-foreground text-xs">gwarancja wygasła</span>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="text-sm, trzy stany: czerwony font-medium / warning font-medium / wyszarzony"
        sources={['src/components/fleet/deadline-cell.tsx:37']}
      >
        <span className="text-destructive text-sm font-medium">2026-10-12</span>
        <span className="text-warning text-sm font-medium">2026-11-05</span>
        <span className="text-muted-foreground text-sm">2027-04-20</span>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="rozmiar dziedziczony: warning font-medium / wyszarzony / bez klasy"
        sources={['src/components/equipment/warranty-cell.tsx:24']}
      >
        <span className="text-warning font-medium">2026-11-02</span>
        <span className="text-muted-foreground">2026-03-01</span>
        <span>2027-08-15</span>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="font-medium, czerwony przy problemie, inaczej domyślny kolor (nie wyszarzony)"
        sources={['src/components/tables/telmak-check.tsx:45']}
      >
        <span className="text-destructive font-medium">Inna kwota</span>
        <span className="font-medium">Zgodna</span>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="font-medium whitespace-nowrap, czerwony vs wyszarzony (słabe dopasowanie)"
        sources={['src/components/tables/expense-duplicates.tsx:57']}
      >
        <span className="text-destructive font-medium whitespace-nowrap">
          Ten sam numer, Ta sama kwota
        </span>
        <span className="text-muted-foreground font-medium whitespace-nowrap">Ta sama kwota</span>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="text-destructive text-xs whitespace-nowrap obok badge statusu"
        sources={['src/components/tables/expense-drafts.tsx:178']}
      >
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone="pending">czeka</Badge>
          <span className="text-destructive text-xs whitespace-nowrap">Duplikat #1234</span>
        </span>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="text-destructive pl-2 doklejony do wyszarzonej etykiety w komórce"
        sources={['src/components/kosztorys/editor/dialogs/catalogue/catalogue-diff-table.tsx:219']}
      >
        <span className="text-muted-foreground">
          Cena wykonawcy (z narzędziami)
          <span className="text-destructive pl-2">przekracza 65% ceny</span>
        </span>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="flex gap-1.5 + AlertIcon size-4, czerwony font-medium tylko przy alarmie"
        sources={['src/app/(frontend)/flota/[id]/page.tsx:60']}
      >
        <span className="text-destructive flex items-center gap-1.5 font-medium">
          <AlertIcon className="size-4" />
          16 240 km
        </span>
        <span className="flex items-center gap-1.5">8 120 km</span>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="HintTooltip text-warning + span text-xs z AlertIcon size-3 text-current pod liczbą"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:268',
        ]}
      >
        <HintTooltip
          content="Przekroczono aktualizację przedmiaru"
          className="text-warning flex-col items-center"
        >
          <span className="whitespace-nowrap">12,5 / 10</span>
          <span className="inline-flex items-center gap-1 text-xs">
            <AlertIcon className="size-3 text-current" />
            przekroczono
          </span>
        </HintTooltip>
      </AuditVariant>
    </AuditGroup>
  )
}
