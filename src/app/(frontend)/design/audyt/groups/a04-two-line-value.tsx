/* eslint-disable local/no-hand-rolled-ui -- audit page renders verbatim copies of hand-rolled markup */
import Link from 'next/link'
import { ChevronDown, Wrench } from 'lucide-react'
import { BalanceCell } from '@/components/ui/balance-cell'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { LabelHintIcon } from '@/components/ui/label-hint-icon'
import { Panel } from '@/components/ui/panel'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A04TwoLineValueGroup() {
  return (
    <AuditGroup
      id="A04"
      title="Wartość z podpisem pod spodem"
      count="20 wystąpień w 16 plikach · 18 wersji"
      drift={[
        'Sposób złamania linii: block na drugim spanie, rodzic flex flex-col, flex flex-col leading-tight, flex flex-col gap-0.5, Button flex-col items-end gap-0 albo ta sama linia (items-baseline).',
        'Rozmiar podpisu: text-xs prawie wszędzie, text-2xs w nagłówkach siatki, Description size="xs" (blokowy <p>) w jednym dialogu.',
        'Kolor podpisu: wyszarzony, albo przełączany ręcznie na text-warning / text-destructive / text-chart-green razem z wartością.',
        'Waga i rozmiar wartości: brak / font-medium / text-sm font-medium / text-lg font-semibold; podpis czasem dostaje font-normal, żeby zgasić pogrubienie rodzica.',
        'Dodatki tylko w pojedynczych kopiach: truncate, whitespace-nowrap, leading-snug na wartości, max-sm:hidden na podpisie.',
      ]}
      proposal={
        <>
          Jeden prymityw <code>StackedValue</code> w <code>ui/</code> (spany, więc działa w komórce
          i w etykiecie): <code>children</code> = wartość, <code>note</code> = podpis,{' '}
          <code>
            noteTone?: &apos;muted&apos; | &apos;warning&apos; | &apos;destructive&apos; |
            &apos;success&apos;
          </code>
          , <code>size?: &apos;xs&apos; | &apos;2xs&apos;</code>, <code>inline?</code> dla wersji w
          jednej linii.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="wartość span.block leading-snug + podpis span.block text-xs"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:281',
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:328',
        ]}
      >
        <div>
          <span className="block leading-snug">Malowanie ścian dwukrotne</span>
          <span className="text-muted-foreground block text-xs">Zgłoszono „malowanie ścian”</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="w pogrubionym span.block, podpisy MARK_CLASS z font-normal"
        sources={[
          'src/components/tables/work-catalogue.tsx:107',
          'src/components/tables/work-catalogue.tsx:110',
        ]}
      >
        <span className="block font-medium">
          Gruntowanie ścian
          <span className="text-muted-foreground block text-xs font-normal">
            występuje z inną j.m.
          </span>
          <span className="text-muted-foreground block text-xs font-normal">
            podobny opis: Gruntowanie sufitów — m2 · 12,00 zł · Malowanie
          </span>
        </span>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="goły span + podpis span.block text-xs"
        sources={['src/components/kosztorys/editor/dialogs/sheet/sheet-rates-block.tsx:50']}
      >
        <div>
          <span>Układanie płytek ściennych</span>
          <span className="text-muted-foreground block text-xs">Łazienka</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="wartość przełącza się na text-warning, podpis zawsze wyszarzony"
        sources={['src/components/kosztorys/editor/dialogs/sheet/sheet-rates-block.tsx:267']}
      >
        <div>
          <span>45,00 zł</span>
          <span className="text-muted-foreground block text-xs">45,00 zł w kosztorysie</span>
        </div>
        <div>
          <span className="text-warning">52,00 zł</span>
          <span className="text-muted-foreground block text-xs">45,00 zł w kosztorysie</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="obie linie w tym samym kolorze (zielony / czerwony / wyszarzony podpis), whitespace-nowrap"
        sources={['src/components/kosztorys/editor/dialogs/sheet/sheet-rates-block.tsx:256']}
      >
        <div>
          <span className="text-chart-green whitespace-nowrap">45,00 zł</span>
          <span className="text-chart-green block text-xs whitespace-nowrap">zgodna</span>
        </div>
        <div>
          <span className="text-destructive whitespace-nowrap">52,00 zł</span>
          <span className="text-destructive block text-xs whitespace-nowrap">
            inna niż w cenniku
          </span>
        </div>
        <div>
          <span className="whitespace-nowrap">38,00 zł</span>
          <span className="text-muted-foreground block text-xs whitespace-nowrap">z cennika</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="div flex flex-col leading-tight, wyszarzony podpis"
        sources={['src/components/equipment/location-cell.tsx:31']}
      >
        <div className="flex flex-col leading-tight">
          <span>Jan Kowalski</span>
          <span className="text-muted-foreground text-xs">od 2026-10-20</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="flex flex-col leading-tight, obie linie text-warning gdy pilne"
        sources={['src/components/equipment/warranty-cell.tsx:23']}
      >
        <div className="flex flex-col leading-tight">
          <span className="text-warning font-medium">2026-11-02</span>
          <span className="text-warning text-xs">za 13 dni</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-muted-foreground">2026-03-01</span>
          <span className="text-muted-foreground text-xs">gwarancja wygasła</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="jak g, ale wartość text-sm i dochodzi text-destructive"
        sources={['src/components/fleet/deadline-cell.tsx:35']}
      >
        <div className="flex flex-col leading-tight">
          <span className="text-destructive text-sm font-medium">2026-10-12</span>
          <span className="text-destructive text-xs">8 dni po terminie</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-warning text-sm font-medium">2026-11-05</span>
          <span className="text-muted-foreground text-xs">za 16 dni</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm">2027-04-20</span>
          <span className="text-muted-foreground text-xs">za 182 dni</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="span flex flex-col font-medium z kolorem kwoty, podpis netto"
        sources={['src/components/tables/transfers.tsx:80']}
      >
        <span className="text-transfer-red-dark flex flex-col font-medium">
          12 345,67 zł
          <span className="text-muted-foreground text-xs">netto 10 037,13 zł</span>
        </span>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="ta sama linia: flex items-baseline gap-2, kwota text-lg font-semibold"
        sources={['src/components/transfers/cards/transfer-card.tsx:61']}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-transfer-red-dark text-lg font-semibold">12 345,67 zł</span>
          <span className="text-muted-foreground text-xs">netto 10 037,13 zł</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="w Button link flex-col items-end gap-0, podpis z font-normal"
        sources={['src/components/tables/investments.tsx:271']}
      >
        <Button variant="link" size="inline" className="flex-col items-end gap-0">
          <BalanceCell value={4250} settled />
          <span className="text-muted-foreground text-xs font-normal">3 pracowników</span>
        </Button>
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="span inline-flex flex-col items-end, podpis obok ikonki ostrzeżenia (HintedValue odtworzony ręcznie)"
        sources={['src/components/tables/users.tsx:59']}
      >
        <span className="inline-flex flex-col items-end">
          <Button variant="link" size="inline" className="flex-col items-end gap-0">
            <span className="font-normal">do zapłaty aktywne (2): 1 111,11 zł</span>
          </Button>
          <span className="inline-flex items-center justify-end gap-1">
            <span className="text-muted-foreground text-xs">2 bez rozliczenia etapu</span>
            <LabelHintIcon
              variant="planeUnconfirmed"
              content="Na tych inwestycjach ten pracownik ma etap z wykonaną pracą bez ustawionego rozliczenia."
            />
          </span>
        </span>
      </AuditVariant>

      <AuditVariant
        letter="m"
        label="span flex flex-col w pozycji menu filtra (bez CommandItem — wymaga kontekstu cmdk)"
        sources={['src/components/filters/filter-multi-select.tsx:302']}
      >
        <span className="flex flex-col">
          Kwota stała
          <span className="text-muted-foreground text-xs">Etapy rozliczane ryczałtem</span>
        </span>
      </AuditVariant>

      <AuditVariant
        letter="n"
        label="Link flex flex-col gap-0.5: font-medium + data text-xs + opis text-sm"
        sources={['src/components/kosztorys/editor/history/history-dialog.tsx:34']}
      >
        <Link href="#A04" className="hover:bg-muted flex flex-col gap-0.5 rounded-md px-2 py-2">
          <span className="font-medium">Przed zmianą stawek</span>
          <span className="text-muted-foreground text-xs">2026-10-20</span>
          <span className="text-muted-foreground text-sm">Zmieniono 12 pozycji</span>
        </Link>
      </AuditVariant>

      <AuditVariant
        letter="o"
        label="dwa divy z truncate: text-sm font-medium + text-xs"
        sources={['src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:158']}
      >
        <Panel className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0">
            <div className="text-foreground truncate text-sm font-medium">Wersja dla klienta</div>
            <div className="text-muted-foreground truncate text-xs">
              20.10.2026 14:32 · Jan Kowalski · Mieszkanie Mokotów
            </div>
          </div>
        </Panel>
      </AuditVariant>

      <AuditVariant
        letter="p"
        label="blokowy p.text-sm font-medium + Description size xs (blokowy p)"
        sources={[
          'src/components/kosztorys/editor/dialogs/catalogue/save-item-to-catalogue-dialog.tsx:85',
        ]}
      >
        <div>
          <p className="text-sm font-medium">Montaż listew przypodłogowych</p>
          <Description withIcon={false} size="xs">
            mb · Podłogi
          </Description>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="q"
        label="nagłówek siatki: div flex flex-col gap-0.5 + div text-2xs leading-tight max-sm:hidden"
        sources={['src/components/kosztorys/editor/grid/report-column.tsx:55']}
      >
        <div className="flex flex-col gap-0.5 whitespace-normal">
          <HeaderLabel className="max-sm:vertical-text max-sm:whitespace-nowrap">
            Zgłoszone
          </HeaderLabel>
          <div className="text-muted-foreground text-2xs leading-tight max-sm:hidden">
            z raportów pracowników
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="r"
        label="nagłówek etapu: span flex min-w-0 flex-col + span text-2xs inline-flex z truncate (bez HeaderMenu)"
        sources={['src/components/kosztorys/editor/grid/stage-header.tsx:106']}
      >
        <span className="flex min-w-0 flex-col">
          <span className="inline-flex items-center gap-2">
            <Wrench className="size-4" />
            <HeaderLabel>Etap 1</HeaderLabel>
            <ChevronDown className="size-4 opacity-50" />
          </span>
          <span className="text-muted-foreground text-2xs inline-flex min-w-0 items-center gap-1">
            <span className="truncate">Jan Kowalski</span>
          </span>
        </span>
      </AuditVariant>
    </AuditGroup>
  )
}
