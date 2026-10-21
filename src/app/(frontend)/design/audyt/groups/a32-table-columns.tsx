/* eslint-disable local/no-hand-rolled-ui -- audit page renders verbatim copies of hand-rolled markup */
'use client'

import type { ReactNode } from 'react'
import { ArrowUpDown, Ban, Eye, Info, Link2, Paperclip } from 'lucide-react'
import { Badge, BadgeButton } from '@/components/ui/badge'
import { BalanceCell } from '@/components/ui/balance-cell'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ContactLink } from '@/components/ui/contact-link'
import { DotBadge } from '@/components/ui/dot-badge'
import { BORDERED_LIST_CLASS } from '@/components/ui/panel'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

type AlignT = 'left' | 'right' | 'center'

type ColumnSampleT = {
  header: ReactNode
  rows: [ReactNode, ReactNode]
  align?: AlignT
  minWidth?: string
  sortable?: boolean
}

const TH = 'text-muted-foreground px-3 py-2 text-left font-medium text-sm'
const TD = 'text-foreground px-3 py-2'
const MARK_CLASS = 'text-muted-foreground block text-xs font-normal'

function columnSample({ header, rows, align, minWidth, sortable = false }: ColumnSampleT) {
  return (
    <div className={cn(BORDERED_LIST_CLASS, 'w-full overflow-x-auto rounded-lg')}>
      <table className="w-full text-sm max-sm:text-xs">
        <thead>
          <tr className="border-border bg-muted/50 border-b">
            <th
              className={cn(
                TH,
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
                sortable && 'cursor-pointer select-none',
                minWidth,
              )}
            >
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                {header}
                {sortable && <ArrowUpDown className="size-3.5 opacity-40" />}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((cell, index) => (
            <tr key={index} className="border-border border-b last:border-b-0">
              <td
                className={cn(
                  TD,
                  align === 'right' && 'text-right',
                  align === 'center' && 'text-center',
                  minWidth,
                )}
              >
                {cell}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function A32TableColumnsGroup() {
  return (
    <AuditGroup
      id="A32"
      title="Tabela — powtarzane definicje kolumn"
      count="118 wystąpień w 23 plikach · 75 wersji"
      drift={[
        "Wyrównanie: kwota raz z meta.align: 'right', raz bez (transakcje, odrzucone wypłaty, „Cena j.m.” w cenniku); status do prawej (kasy, użytkownicy, flota, inwestycje) albo do lewej (sprzęt, raporty, leady); akcje do prawej, do lewej, na środku albo jako pierwsza kolumna.",
        'Formatter: formatPLN vs formatPLNOrDash vs formatNet (bez „zł”) vs BalanceCell; data formatPLDate vs formatPLDateTime, pusta data jako „—”, jako „” albo bez obsługi; tabular-nums na dacie tylko w trzech tabelach.',
        'Szerokość: raz size, raz meta.minWidth (min-w-36 / 40 / 48 / 56 / 64 / 96 / 112); size działa tylko w tabeli wirtualizowanej, więc w cenniku (72–320) i w kolumnie zaznaczania leadów i zgłoszeń (40) nic nie robi.',
        'Sortowanie: enableSorting: true wpisane ręcznie, choć kolumna z akcesorem sortuje się domyślnie (kasy, leady, inwestycje); opis i notatka raz enableSorting: false, raz sortowalne; compareDescriptions jako sortingFn tylko w cenniku i w przeglądzie raportu.',
        'Nagłówek: ta sama kolumna jako „Akcje” / „Podgląd” / „Anuluj” / pusty; „Data” / „Data wyst.” / „Utworzono” / „Czas dodania”; „Opis” / „Opis prac” / „Opis pracy” / „Praca”; osoba jako „Nazwa” vs „Imię i nazwisko”.',
        'Lokalne fabryki zamiast wspólnych: moneyColumn (materiały), relationLink (transakcje), lpColumn / countColumn / sourceColumn (cennik); wspólne są tylko actionsColumn, dateCell, komórki SelectRowCell / SelectPageHeader, BalanceCell i HintedValue — a rozliczenie wypłat i przegląd raportu omijają nawet SelectRowCell.',
      ]}
      proposal={
        <>
          Wspólne fabryki w <code>tables/columns/</code>:{' '}
          <code>
            amountColumn({'{'} format: &apos;pln&apos; | &apos;plnOrDash&apos; | &apos;net&apos; |
            &apos;balance&apos; {'}'})
          </code>{' '}
          (zawsze do prawej, tabular-nums),{' '}
          <code>
            dateColumn({'{'} withTime, emptyAs = &apos;—&apos;, sortDescFirst {'}'})
          </code>
          , <code>statusColumn</code>,{' '}
          <code>
            relationColumn({'{'} href, emptyAs, minWidth {'}'})
          </code>{' '}
          dla nazwy / inwestycji / pracownika,{' '}
          <code>
            textColumn({'{'} muted, multiline, truncate, emptyAs {'}'})
          </code>{' '}
          dla opisu i notatki oraz{' '}
          <code>
            selectColumn({'{'} onToggle, onTogglePage {'}'})
          </code>
          ; pozostałe kolumny akcji na istniejący <code>actionsColumn</code>; <code>size</code>{' '}
          tylko w tabelach wirtualizowanych.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="kwota · a: do prawej, goły formatPLNOrDash"
        sources={[
          'src/components/tables/expense-duplicates.tsx:89',
          'src/components/tables/telmak-check.tsx:55',
          'src/components/tables/telmak-check.tsx:60',
          'src/components/tables/investments.tsx:205',
          'src/components/tables/investments.tsx:244',
          'src/components/tables/investments.tsx:252',
          'src/components/forms/settle-payouts-form/settle-payouts-table.tsx:166',
          'src/components/forms/settle-payouts-form/settle-payouts-table.tsx:171',
          'src/components/forms/settle-payouts-form/settle-payouts-table.tsx:177',
        ]}
      >
        {columnSample({
          header: 'Kwota',
          align: 'right',
          sortable: true,
          rows: ['1 111,11 zł', '—'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="kwota · b: do prawej, BalanceCell (w inwestycjach z tooltipem nagłówka)"
        sources={[
          'src/components/tables/cash-registers.tsx:34',
          'src/components/tables/investments.tsx:145',
          'src/components/tables/investments.tsx:188',
        ]}
      >
        {columnSample({
          header: 'Saldo',
          align: 'right',
          sortable: true,
          rows: [<BalanceCell key="a" value={12345.67} />, <BalanceCell key="b" value={-88} />],
        })}
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="kwota · c: do prawej, tabular-nums + formatPLNOrDash, sortUndefined: 'last'"
        sources={[
          'src/components/tables/fleet.tsx:57',
          'src/components/equipment/equipment-history.tsx:42',
        ]}
      >
        {columnSample({
          header: 'Koszty',
          align: 'right',
          sortable: true,
          rows: [
            <span key="a" className="tabular-nums">
              1 111,11 zł
            </span>,
            <span key="b" className="tabular-nums">
              —
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="kwota · d: lokalna fabryka moneyColumn — do prawej, size 120, tabular-nums + formatNet (bez „zł”)"
        sources={['src/components/kosztorys/summary/tables/materials-transactions-table.tsx:129']}
      >
        {columnSample({
          header: 'Netto',
          align: 'right',
          sortable: true,
          rows: [
            <span key="a" className="tabular-nums">
              1 111,11
            </span>,
            <span key="b" className="tabular-nums">
              12 345,67
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="kwota · e: do prawej, size 140, text-chart-green tabular-nums + formatNet"
        sources={['src/components/kosztorys/summary/tables/subcontractor-payouts-table.tsx:43']}
      >
        {columnSample({
          header: 'Kwota',
          align: 'right',
          sortable: true,
          rows: [
            <span key="a" className="text-chart-green tabular-nums">
              1 111,11
            </span>,
            <span key="b" className="text-chart-green tabular-nums">
              12 345,67
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="kwota · f: do prawej, font-medium + formatPLN"
        sources={['src/components/tables/investments.tsx:238']}
      >
        {columnSample({
          header: 'Wydatki inwestycyjne',
          align: 'right',
          sortable: true,
          rows: [
            <span key="a" className="font-medium">
              1 111,11 zł
            </span>,
            <span key="b" className="font-medium">
              12 345,67 zł
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="kwota · g: bez wyrównania (do lewej), goły formatPLN"
        sources={['src/components/receipt-confirmation/rejected-receipts.tsx:56']}
      >
        {columnSample({
          header: 'Kwota',
          sortable: true,
          rows: ['1 111,11 zł', '12 345,67 zł'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="kwota · h: bez wyrównania (do lewej), flex-col font-medium w kolorze typu + podpis netto"
        sources={['src/components/tables/transfers.tsx:69']}
      >
        {columnSample({
          header: 'Kwota',
          sortable: true,
          rows: [
            <span key="a" className="text-section-red flex flex-col font-medium">
              1 230,00 zł
              <span className="text-muted-foreground text-xs">netto 1 000,00 zł</span>
            </span>,
            <span key="b" className="text-section-green flex flex-col font-medium">
              12 345,67 zł
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="kwota · i: bez wyrównania (do lewej), size 120 (martwy — tabela nie jest wirtualizowana), tabular-nums + formatPLN"
        sources={['src/components/tables/work-catalogue.tsx:156']}
      >
        {columnSample({
          header: 'Cena j.m.',
          sortable: true,
          rows: [
            <span key="a" className="tabular-nums">
              88,00 zł
            </span>,
            <span key="b" className="tabular-nums">
              1 111,11 zł
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="data · j: goły formatPLDate (dd.MM.yyyy), bez szerokości"
        sources={[
          'src/components/tables/transfers.tsx:63',
          'src/components/tables/expense-duplicates.tsx:84',
          'src/components/receipt-confirmation/rejected-receipts.tsx:40',
          'src/components/tables/presets.tsx:23',
          'src/components/tables/telmak-check.tsx:54',
          'src/components/tables/presets.tsx:22',
        ]}
      >
        {columnSample({
          header: 'Data',
          sortable: true,
          rows: ['20.10.2026', '03.09.2026'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="data · k: goły formatPLDateTime, min-w-40 (zgłoszenia podają locale)"
        sources={[
          'src/components/tables/transfers.tsx:247',
          'src/components/tables/expense-drafts.tsx:134',
          'src/components/tables/transfers.tsx:204',
        ]}
      >
        {columnSample({
          header: 'Czas dodania',
          minWidth: 'min-w-40',
          sortable: true,
          rows: ['20.10.2026, 14:30', '03.09.2026, 08:05'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="data · l: tabular-nums + formatPLDate, size 96 (tabela wirtualizowana)"
        sources={[
          'src/components/kosztorys/summary/tables/subcontractor-payouts-table.tsx:25',
          'src/components/kosztorys/summary/tables/materials-transactions-table.tsx:56',
        ]}
      >
        {columnSample({
          header: 'Data',
          sortable: true,
          rows: [
            <span key="a" className="tabular-nums">
              20.10.2026
            </span>,
            <span key="b" className="tabular-nums">
              03.09.2026
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="m"
        label="data · m: jak j + sortDescFirst: true"
        sources={['src/components/tables/investments.tsx:104']}
      >
        {columnSample({
          header: 'Data dodania',
          sortable: true,
          rows: ['20.10.2026', '03.09.2026'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="n"
        label="data · n: tabular-nums + formatPLDate, bez size"
        sources={['src/components/equipment/equipment-history.tsx:17']}
      >
        {columnSample({
          header: 'Data',
          sortable: true,
          rows: [
            <span key="a" className="tabular-nums">
              20.10.2026
            </span>,
            <span key="b" className="tabular-nums">
              03.09.2026
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="o"
        label="data · o: goły formatPLDateTime z locale, bez szerokości, sortowanie wyliczane"
        sources={['src/components/tables/worker-reports.tsx:54']}
      >
        {columnSample({
          header: 'Wysłano',
          sortable: true,
          rows: ['20.10.2026, 14:30', '03.09.2026, 08:05'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="p"
        label="data · p: goły formatPLDateTime, min-w-36"
        sources={['src/components/receipt-confirmation/rejected-receipts.tsx:97']}
      >
        {columnSample({
          header: 'Odrzucono',
          minWidth: 'min-w-36',
          sortable: true,
          rows: ['20.10.2026, 14:30', '03.09.2026, 08:05'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="q"
        label="data · q: formatPLDateTime, pusta → „—”, enableSorting: true (zbędne)"
        sources={['src/components/tables/leads.tsx:88']}
      >
        {columnSample({
          header: 'Data zgłoszenia',
          sortable: true,
          rows: ['20.10.2026, 14:30', '—'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="r"
        label="data · r: „data · kto” albo „—”, enableSorting: false, bez szerokości"
        sources={['src/components/tables/worker-reports.tsx:75']}
      >
        {columnSample({
          header: 'Weryfikował',
          rows: ['20.10.2026, 14:30 · Jan Kowalski', '—'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="s"
        label="data · s: „data · kto” albo „—”, min-w-56, sortowanie wyliczane"
        sources={['src/components/tables/expense-drafts.tsx:185']}
      >
        {columnSample({
          header: 'Decyzja',
          minWidth: 'min-w-56',
          sortable: true,
          rows: ['20.10.2026, 14:30 · Jan Kowalski', '—'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="t"
        label="akcje · t: „Akcje”, do prawej, div flex items-center justify-end gap-1"
        sources={[
          'src/components/tables/transfers.tsx:287',
          'src/components/tables/investments.tsx:325',
          'src/components/tables/fleet.tsx:100',
          'src/components/tables/cash-registers.tsx:58',
          'src/components/tables/users.tsx:165',
          'src/components/tables/equipment.tsx:103',
          'src/components/tables/leads.tsx:140',
        ]}
      >
        {columnSample({
          header: 'Akcje',
          align: 'right',
          rows: [
            <div key="a" className="flex items-center justify-end gap-1">
              <EditButton />
              <DeleteButton />
            </div>,
            <div key="b" className="flex items-center justify-end gap-1">
              <DeleteButton />
            </div>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="u"
        label="akcje · u: „Akcje”, do prawej, komponent wprost w komórce (bez wrappera)"
        sources={[
          'src/components/tables/presets.tsx:24',
          'src/components/tables/work-catalogue.tsx:284',
          'src/components/tables/sheets.tsx:48',
          'src/components/tables/sheets.tsx:92',
        ]}
      >
        {columnSample({
          header: 'Akcje',
          align: 'right',
          rows: [
            <RowActionButton key="a" icon={Link2} label="Powiąż z inwestycją" />,
            <RowActionButton key="b" icon={Link2} label="Powiąż z inwestycją" />,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="v"
        label="akcje · v: nagłówek „Podgląd” (w historii zgłoszeń pusty) + meta.label „Akcje”, do lewej, div flex items-center gap-1"
        sources={[
          'src/components/tables/worker-reports.tsx:85',
          'src/components/tables/expense-drafts.tsx:69',
        ]}
      >
        {columnSample({
          header: 'Podgląd',
          rows: [
            <div key="a" className="flex items-center gap-1">
              <RowActionButton icon={Eye} label="Podgląd" />
            </div>,
            <div key="b" className="flex items-center gap-1">
              <RowActionButton icon={Eye} label="Podgląd" />
            </div>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="w"
        label="akcje · w: pierwsza kolumna, do lewej, komponent wprost („Akcje” w duplikatach, „Anuluj” w odrzuconych)"
        sources={[
          'src/components/tables/expense-duplicates.tsx:46',
          'src/components/receipt-confirmation/rejected-receipts.tsx:22',
        ]}
      >
        {columnSample({
          header: 'Anuluj',
          rows: [
            <RowActionButton key="a" icon={Ban} label="Anuluj transakcję" />,
            <RowActionButton key="b" icon={Ban} label="Anuluj transakcję" />,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="x"
        label="akcje · x: „Akcje”, do prawej, div justify-end gap-2"
        sources={['src/components/tables/telmak-check.tsx:84']}
      >
        {columnSample({
          header: 'Akcje',
          align: 'right',
          rows: [
            <div key="a" className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline">
                <Paperclip />
                Dołącz do #1234
              </Button>
            </div>,
            <div key="b" className="flex items-center justify-end gap-2" />,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="y"
        label="akcje · y: „Akcje”, na środku, enableHiding: false (odrzucenie w przeglądzie raportu)"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:403',
        ]}
      >
        {columnSample({
          header: 'Akcje',
          align: 'center',
          rows: [
            <Button
              key="a"
              variant="ghost"
              size="xs"
              className="text-muted-foreground whitespace-nowrap"
            >
              Odrzuć
            </Button>,
            <Button
              key="b"
              variant="ghost"
              size="xs"
              className="text-destructive whitespace-nowrap"
            >
              Odrzucona · cofnij
            </Button>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="z"
        label="status · z: do prawej, przełącznik BadgeButton / Badge (w kasach zbędne enableSorting: true)"
        sources={[
          'src/components/tables/cash-registers.tsx:40',
          'src/components/tables/users.tsx:114',
        ]}
      >
        {columnSample({
          header: 'Status',
          align: 'right',
          sortable: true,
          rows: [
            <BadgeButton key="a" tone="positive" onClick={() => {}}>
              Aktywna
            </BadgeButton>,
            <Badge key="b" tone="muted">
              Nieaktywna
            </Badge>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="aa"
        label="status · aa: do lewej, badge encji (EquipmentStatusBadge / WorkerReportStatusBadge — tu Badge)"
        sources={[
          'src/components/tables/equipment.tsx:97',
          'src/components/tables/worker-reports.tsx:70',
        ]}
      >
        {columnSample({
          header: 'Status',
          sortable: true,
          rows: [
            <Badge key="a" tone="positive">
              Na budowie
            </Badge>,
            <Badge key="b" tone="pending">
              W serwisie
            </Badge>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ab"
        label="status · ab: do lewej, przełącznik BadgeButton, tooltip w nagłówku, enableSorting: true (zbędne)"
        sources={['src/components/tables/leads.tsx:97']}
      >
        {columnSample({
          header: 'Status kontaktu',
          sortable: true,
          rows: [
            <BadgeButton key="a" tone="positive" onClick={() => {}}>
              Skontaktowano
            </BadgeButton>,
            <BadgeButton key="b" tone="muted" onClick={() => {}}>
              Oczekuje
            </BadgeButton>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ac"
        label="status · ac: do prawej, badge encji (VehicleStatusBadge — tu Badge)"
        sources={['src/components/tables/fleet.tsx:94']}
      >
        {columnSample({
          header: 'Status',
          align: 'right',
          sortable: true,
          rows: [
            <Badge key="a" tone="positive">
              Aktywny
            </Badge>,
            <Badge key="b" tone="muted">
              Wycofany
            </Badge>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ad"
        label="status · ad: do prawej + div flex justify-end wokół selecta inline, enableSorting: true (select odwzorowany Badge)"
        sources={['src/components/tables/investments.tsx:314']}
      >
        {columnSample({
          header: 'Status',
          align: 'right',
          sortable: true,
          rows: [
            <div key="a" className="flex justify-end">
              <Badge tone="positive">W realizacji</Badge>
            </div>,
            <div key="b" className="flex justify-end">
              <Badge tone="muted">Zakończona</Badge>
            </div>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ae"
        label="status · ae: do lewej, min-w-48, flex-wrap gap-2: badge + czerwony tekst duplikatu"
        sources={['src/components/tables/expense-drafts.tsx:165']}
      >
        {columnSample({
          header: 'Status',
          minWidth: 'min-w-48',
          sortable: true,
          rows: [
            <span key="a" className="flex flex-wrap items-center gap-2">
              <Badge tone="pending">Oczekuje</Badge>
              <span className="text-destructive text-xs whitespace-nowrap">Duplikat #1234</span>
            </span>,
            <span key="b" className="flex flex-wrap items-center gap-2">
              <Badge tone="positive">Zaakceptowane</Badge>
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="af"
        label="status · af: do lewej, sam wyszarzony tekst (akcesor na etykiecie)"
        sources={['src/components/tables/sheets.tsx:42']}
      >
        {columnSample({
          header: 'Status',
          sortable: true,
          rows: [
            <span key="a" className="text-muted-foreground">
              Powiązany
            </span>,
            <span key="b" className="text-muted-foreground">
              Niepowiązany
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ag"
        label="status · ag: do lewej, tekst font-medium, text-destructive gdy nie „ok”"
        sources={['src/components/tables/telmak-check.tsx:42']}
      >
        {columnSample({
          header: 'Status',
          sortable: true,
          rows: [
            <span key="a" className="text-destructive font-medium">
              Inna kwota
            </span>,
            <span key="b" className="font-medium">
              Zgodne
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ah"
        label="status · ah: do lewej, tekst font-medium whitespace-nowrap, destructive albo muted"
        sources={['src/components/tables/expense-duplicates.tsx:53']}
      >
        {columnSample({
          header: 'Status',
          sortable: true,
          rows: [
            <span key="a" className="text-destructive font-medium whitespace-nowrap">
              Ten sam numer
            </span>,
            <span key="b" className="text-muted-foreground font-medium whitespace-nowrap">
              Ta sama kwota
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ai"
        label="nazwa · ai: „Nazwa”, bez cell (goły tekst), bez szerokości"
        sources={[
          'src/components/tables/cash-registers.tsx:20',
          'src/components/tables/presets.tsx:11',
          'src/components/tables/leads.tsx:60',
        ]}
      >
        {columnSample({
          header: 'Nazwa',
          sortable: true,
          rows: ['Kasa główna', 'Kasa Jana Kowalskiego'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="aj"
        label="nazwa · aj: span font-medium (we flocie kolumna „Rejestracja”)"
        sources={['src/components/tables/equipment.tsx:34', 'src/components/tables/fleet.tsx:24']}
      >
        {columnSample({
          header: 'Nazwa',
          sortable: true,
          rows: [
            <span key="a" className="font-medium">
              Wiertarka udarowa
            </span>,
            <span key="b" className="font-medium">
              Szlifierka kątowa
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ak"
        label="nazwa · ak: span font-medium owija OptionalLink"
        sources={['src/components/tables/sheets.tsx:24', 'src/components/tables/sheets.tsx:79']}
      >
        {columnSample({
          header: 'Nazwa',
          sortable: true,
          rows: [
            <span key="a" className="font-medium">
              <a href="#" className="hover:underline">
                Kosztorys Mokotów
              </a>
            </span>,
            <span key="b" className="font-medium">
              Kosztorys bez inwestycji
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="al"
        label="nazwa · al: „Imię i nazwisko”, goły tekst, min-w-56"
        sources={['src/components/tables/users.tsx:97']}
      >
        {columnSample({
          header: 'Imię i nazwisko',
          minWidth: 'min-w-56',
          sortable: true,
          rows: ['Jan Kowalski', 'Anna Nowak'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="am"
        label="nazwa · am: „Nazwa”, OptionalLink bez pogrubienia, min-w-56"
        sources={['src/components/tables/investments.tsx:96']}
      >
        {columnSample({
          header: 'Nazwa',
          minWidth: 'min-w-56',
          sortable: true,
          rows: [
            <a key="a" href="#" className="hover:underline">
              Mieszkanie Mokotów
            </a>,
            <a key="b" href="#" className="hover:underline">
              Dom Wilanów
            </a>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="an"
        label="nazwa · an: nagłówek z kontekstu, OptionalLink target=_blank underline-offset-4"
        sources={['src/components/forms/settle-payouts-form/settle-payouts-table.tsx:162']}
      >
        {columnSample({
          header: 'Pracownik',
          sortable: true,
          rows: [
            <a key="a" href="#" target="_blank" className="underline-offset-4 hover:underline">
              Jan Kowalski
            </a>,
            <a key="b" href="#" target="_blank" className="underline-offset-4 hover:underline">
              Anna Nowak
            </a>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ao"
        label="opis · ao: „Opis”, whitespace-pre-line, min-w-64, pusty bez „—”"
        sources={['src/components/tables/transfers.tsx:125']}
      >
        {columnSample({
          header: 'Opis',
          minWidth: 'min-w-64',
          sortable: true,
          rows: [
            <span key="a" className="whitespace-pre-line">
              {'Płytki do łazienki\nfaktura 12/10'}
            </span>,
            <span key="b" className="whitespace-pre-line" />,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ap"
        label="opis · ap: „Opis”, whitespace-pre-line, min-w-56, pusty → „—”"
        sources={['src/components/receipt-confirmation/rejected-receipts.tsx:87']}
      >
        {columnSample({
          header: 'Opis',
          minWidth: 'min-w-56',
          sortable: true,
          rows: [
            <span key="a" className="whitespace-pre-line">
              {'Płytki do łazienki\nfaktura 12/10'}
            </span>,
            <span key="b" className="whitespace-pre-line">
              —
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="aq"
        label="opis · aq: „Opis”, wyszarzony, pusty → „—”, size 320, enableSorting: false"
        sources={['src/components/kosztorys/summary/tables/subcontractor-payouts-table.tsx:34']}
      >
        {columnSample({
          header: 'Opis',
          rows: [
            <span key="a" className="text-muted-foreground">
              Wypłata za etap 1
            </span>,
            <span key="b" className="text-muted-foreground">
              —
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ar"
        label="opis · ar: „Opis”, wyszarzony, truncate max-w-64 + tooltip, size 260, enableSorting: false"
        sources={['src/components/kosztorys/summary/tables/materials-transactions-table.tsx:65']}
      >
        {columnSample({
          header: 'Opis',
          rows: [
            <SimpleTooltip key="a" content="Płytki ceramiczne do łazienki na parterze, klej i fuga">
              <span className="text-muted-foreground block max-w-64 cursor-help truncate">
                Płytki ceramiczne do łazienki na parterze, klej i fuga
              </span>
            </SimpleTooltip>,
            <span key="b" className="text-muted-foreground">
              —
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="as"
        label="opis · as: „Opis pracy”, block font-medium + dopiski, size 320, sortingFn compareDescriptions, min-w-112 fill"
        sources={['src/components/tables/work-catalogue.tsx:95']}
      >
        {columnSample({
          header: 'Opis pracy',
          minWidth: 'min-w-112',
          sortable: true,
          rows: [
            <span key="a" className="block font-medium">
              Malowanie ścian dwukrotne
              <span className={MARK_CLASS}>występuje z inną j.m.</span>
            </span>,
            <span key="b" className="block font-medium">
              Układanie płytek gresowych
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="at"
        label="opis · at: „Opis pracy (EN)”, block bez pogrubienia, size 320, min-w-112, domyślne sortowanie"
        sources={['src/components/tables/work-catalogue.tsx:125']}
      >
        {columnSample({
          header: 'Opis pracy (EN)',
          minWidth: 'min-w-112',
          sortable: true,
          rows: [
            <span key="a" className="block">
              Wall painting, two coats
            </span>,
            <span key="b" className="block">
              Laying porcelain tiles
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="au"
        label="opis · au: „Opis prac”, block leading-snug, fill min-w-64, enableSorting: false"
        sources={['src/components/worker-reports/report-preview-table.tsx:38']}
      >
        {columnSample({
          header: 'Opis prac',
          minWidth: 'min-w-64',
          rows: [
            <span key="a" className="block leading-snug">
              Malowanie ścian dwukrotne
            </span>,
            <span key="b" className="block leading-snug">
              Układanie płytek gresowych
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="av"
        label="opis · av: „Opis prac”, sortingFn compareDescriptions, fill min-w-96 (komórka RozpiskaDescriptionCell — tu sam tekst)"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:425',
        ]}
      >
        {columnSample({
          header: 'Opis prac',
          minWidth: 'min-w-96',
          sortable: true,
          rows: ['Malowanie ścian dwukrotne', 'Układanie płytek gresowych'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="aw"
        label="opis · aw: „Opis prac”, sortingFn compareDescriptions, min-w-80 w-1/3 bez fill (komórka ManualDescriptionCell — tu sam tekst)"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:521',
        ]}
      >
        {columnSample({
          header: 'Opis prac',
          minWidth: 'min-w-80 w-1/3',
          sortable: true,
          rows: ['Montaż listew przypodłogowych', 'Wywóz gruzu'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ax"
        label="opis · ax: „Praca”, wyszarzony prefiks sekcji „Sekcja · ”, accessorKey description"
        sources={['src/components/kosztorys/editor/history/history-changes-table.tsx:8']}
      >
        {columnSample({
          header: 'Praca',
          sortable: true,
          rows: [
            <>
              <span className="text-muted-foreground">Łazienka · </span>
              Układanie płytek gresowych
            </>,
            <>Malowanie ścian dwukrotne</>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ay"
        label="inwestycja · ay: span, pusta → „—” (||), bez linku"
        sources={[
          'src/components/tables/equipment.tsx:79',
          'src/components/equipment/equipment-history.tsx:26',
        ]}
      >
        {columnSample({
          header: 'Inwestycja',
          sortable: true,
          rows: [<span key="a">Mieszkanie Mokotów</span>, <span key="b">—</span>],
        })}
      </AuditVariant>

      <AuditVariant
        letter="az"
        label="inwestycja · az: span whitespace-nowrap, pusta → „—” (??), bez linku"
        sources={[
          'src/components/tables/expense-duplicates.tsx:109',
          'src/components/tables/telmak-check.tsx:65',
        ]}
      >
        {columnSample({
          header: 'Inwestycja',
          sortable: true,
          rows: [
            <span key="a" className="whitespace-nowrap">
              Mieszkanie Mokotów
            </span>,
            <span key="b" className="whitespace-nowrap">
              —
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="ba"
        label="inwestycja · ba: OptionalLink przez relationLink, min-w-56, niesortowalna (spoza transferSort)"
        sources={['src/components/tables/transfers.tsx:102']}
      >
        {columnSample({
          header: 'Inwestycja',
          minWidth: 'min-w-56',
          rows: [
            <a key="a" href="#" className="hover:underline">
              Mieszkanie Mokotów
            </a>,
            '—',
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bb"
        label="inwestycja · bb: OptionalLink, pusta → „Bez inwestycji”, min-w-56, sortowanie wyliczane"
        sources={['src/components/tables/expense-drafts.tsx:118']}
      >
        {columnSample({
          header: 'Inwestycja',
          minWidth: 'min-w-56',
          sortable: true,
          rows: [
            <a key="a" href="#" className="hover:underline">
              Mieszkanie Mokotów
            </a>,
            'Bez inwestycji',
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bc"
        label="inwestycja · bc: OptionalLink, bez szerokości, sortowanie wyliczane"
        sources={['src/components/tables/worker-reports.tsx:32']}
      >
        {columnSample({
          header: 'Inwestycja',
          sortable: true,
          rows: [
            <a key="a" href="#" className="hover:underline">
              Mieszkanie Mokotów
            </a>,
            <a key="b" href="#" className="hover:underline">
              Dom Wilanów
            </a>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bd"
        label="inwestycja · bd: OptionalLink, pusta → „—”, min-w-40"
        sources={['src/components/receipt-confirmation/rejected-receipts.tsx:60']}
      >
        {columnSample({
          header: 'Inwestycja',
          minWidth: 'min-w-40',
          sortable: true,
          rows: [
            <a key="a" href="#" className="hover:underline">
              Mieszkanie Mokotów
            </a>,
            '—',
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="be"
        label="notatka · be: „Notatka”, wyszarzona, pusta → „—”, enableSorting: false"
        sources={['src/components/equipment/equipment-history.tsx:31']}
      >
        {columnSample({
          header: 'Notatka',
          rows: [
            <span key="a" className="text-muted-foreground">
              Wymiana szczotek
            </span>,
            <span key="b" className="text-muted-foreground">
              —
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bf"
        label="notatka · bf: „Notatka”, break-words, pusta → „—”, min-w-64, enableSorting: false"
        sources={['src/components/tables/expense-drafts.tsx:148']}
      >
        {columnSample({
          header: 'Notatka',
          minWidth: 'min-w-64',
          rows: [
            <span key="a" className="break-words">
              Paragon z Castoramy, klej do płytek
            </span>,
            <span key="b" className="break-words">
              —
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bg"
        label="notatka · bg: „Notatka”, pierwsza linia w <button> truncate max-w-32 + tooltip, size 160, enableSorting: false"
        sources={['src/components/kosztorys/summary/tables/materials-transactions-table.tsx:82']}
      >
        {columnSample({
          header: 'Notatka',
          rows: [
            <SimpleTooltip key="a" content="FV 12/10/2026 Castorama">
              <button
                type="button"
                className="text-muted-foreground focus-visible:ring-ring/50 block max-w-32 cursor-help truncate text-left focus-visible:ring-3"
              >
                FV 12/10/2026 Castorama
              </button>
            </SimpleTooltip>,
            <span key="b" className="text-muted-foreground">
              —
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bh"
        label="notatka · bh: „Notatka”, na środku, NotePopover (ikona ghost size icon), niesortowalna"
        sources={['src/components/tables/transfers.tsx:146']}
      >
        {columnSample({
          header: 'Notatka',
          align: 'center',
          rows: [
            <Button key="a" variant="ghost" size="icon" className="text-muted-foreground">
              <Info />
            </Button>,
            null,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bi"
        label="notatka · bi: „Uwagi”, goły tekst, min-w-64, sortowalna"
        sources={['src/components/tables/telmak-check.tsx:69']}
      >
        {columnSample({
          header: 'Uwagi',
          minWidth: 'min-w-64',
          sortable: true,
          rows: ['Faktura wystawiona na inną kasę', ''],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bj"
        label="notatka · bj: „Komentarz do pracy”, wyszarzona block, size 280 (martwy), sortowalna"
        sources={['src/components/tables/work-catalogue.tsx:226']}
      >
        {columnSample({
          header: 'Komentarz do pracy',
          sortable: true,
          rows: [
            <span key="a" className="text-muted-foreground block">
              Cena z materiałem pomocniczym
            </span>,
            <span key="b" className="text-muted-foreground block" />,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bk"
        label="zaznaczenie · bk: SelectPageHeader + SelectRowCell, size 40 (martwy), enableHiding: false"
        sources={[
          'src/components/tables/leads.tsx:42',
          'src/components/tables/expense-drafts.tsx:82',
        ]}
      >
        {columnSample({
          header: <Checkbox checked="indeterminate" aria-label="Zaznacz wszystkie na stronie" />,
          rows: [
            <Checkbox key="a" checked aria-label="Zaznacz Jan Kowalski" />,
            <Checkbox key="b" checked={false} aria-label="Zaznacz Anna Nowak" />,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bl"
        label="zaznaczenie · bl: pusty nagłówek, SelectRowCell, size 40 (tabela wirtualizowana), ukrywalna"
        sources={[
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-picker-table.tsx:29',
        ]}
      >
        {columnSample({
          header: '',
          rows: [
            <Checkbox key="a" checked aria-label="Malowanie ścian dwukrotne" />,
            <Checkbox key="b" checked={false} aria-label="Układanie płytek gresowych" />,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bm"
        label="zaznaczenie · bm: pusty nagłówek, własny Checkbox z disabled zamiast SelectRowCell, bez size, ukrywalna"
        sources={['src/components/forms/settle-payouts-form/settle-payouts-table.tsx:157']}
      >
        {columnSample({
          header: '',
          rows: [
            <Checkbox key="a" checked aria-label="Wypłać: Jan Kowalski" />,
            <Checkbox key="b" checked={false} disabled aria-label="Wypłać: Anna Nowak" />,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bn"
        label="zaznaczenie · bn: własny TickHeader „zaznacz wszystkie” + TickCell, na środku, enableHiding: false"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:396',
        ]}
      >
        {columnSample({
          header: <Checkbox checked="indeterminate" aria-label="Zaznacz wszystkie" />,
          align: 'center',
          rows: [
            <Checkbox key="a" checked aria-label="Przyjmij" />,
            <Checkbox key="b" checked={false} aria-label="Przyjmij" />,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bo"
        label="pracownik · bo: OptionalLink, min-w-40 (w transakcjach niesortowalna, w zgłoszeniach wyliczane, w odrzuconych domyślne)"
        sources={[
          'src/components/tables/transfers.tsx:178',
          'src/components/tables/expense-drafts.tsx:108',
          'src/components/receipt-confirmation/rejected-receipts.tsx:46',
        ]}
      >
        {columnSample({
          header: 'Pracownik',
          minWidth: 'min-w-40',
          sortable: true,
          rows: [
            <a key="a" href="#" className="hover:underline">
              Jan Kowalski
            </a>,
            <a key="b" href="#" className="hover:underline">
              Anna Nowak
            </a>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bp"
        label="pracownik · bp: OptionalLink, bez szerokości, sortowanie wyliczane"
        sources={['src/components/tables/worker-reports.tsx:43']}
      >
        {columnSample({
          header: 'Pracownik',
          sortable: true,
          rows: [
            <a key="a" href="#" className="hover:underline">
              Jan Kowalski
            </a>,
            <a key="b" href="#" className="hover:underline">
              Anna Nowak
            </a>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bq"
        label="pracownik · bq: goły tekst bez linku, size 200 (tabela wirtualizowana)"
        sources={['src/components/kosztorys/summary/tables/subcontractor-payouts-table.tsx:33']}
      >
        {columnSample({
          header: 'Pracownik',
          sortable: true,
          rows: ['Jan Kowalski', 'Nieprzypisany'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="br"
        label="kontakt · br: ContactLink (mailto / tel), bez szerokości"
        sources={[
          'src/components/tables/investments.tsx:299',
          'src/components/tables/leads.tsx:73',
          'src/components/tables/leads.tsx:78',
        ]}
      >
        {columnSample({
          header: 'Email',
          sortable: true,
          rows: [
            <ContactLink key="a" type="email" value="jan.kowalski@example.com" />,
            <ContactLink key="b" type="email" value={undefined} />,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bs"
        label="kontakt · bs: ContactLink telefonu + min-w-36"
        sources={['src/components/tables/investments.tsx:293']}
      >
        {columnSample({
          header: 'Telefon',
          minWidth: 'min-w-36',
          sortable: true,
          rows: [
            <ContactLink key="a" type="phone" value="600 100 200" />,
            <ContactLink key="b" type="phone" value={undefined} />,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bt"
        label="kontakt · bt: e-mail jako goły tekst, bez mailto"
        sources={['src/components/tables/users.tsx:110']}
      >
        {columnSample({
          header: 'Email',
          sortable: true,
          rows: ['jan.kowalski@example.com', 'anna.nowak@example.com'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bu"
        label="typ · bu: „Typ”, min-w-56, DotBadge typu + Badge „od pracownika”"
        sources={['src/components/tables/transfers.tsx:108']}
      >
        {columnSample({
          header: 'Typ',
          minWidth: 'min-w-56',
          sortable: true,
          rows: [
            <span key="a" className="flex flex-wrap items-center gap-1">
              <DotBadge color="section-red">Wydatek inwestycyjny</DotBadge>
              <Badge tone="muted">od pracownika</Badge>
            </span>,
            <span key="b" className="flex flex-wrap items-center gap-1">
              <DotBadge color="section-green">Wpłata od inwestora</DotBadge>
            </span>,
          ],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bv"
        label="typ · bv: „Typ”, goła etykieta z mapy, bez szerokości"
        sources={['src/components/tables/cash-registers.tsx:24']}
      >
        {columnSample({
          header: 'Typ',
          sortable: true,
          rows: ['Główna', 'Pomocnicza'],
        })}
      </AuditVariant>

      <AuditVariant
        letter="bw"
        label="typ · bw: „Typ”, goła etykieta z mapy, min-w-40"
        sources={['src/components/receipt-confirmation/rejected-receipts.tsx:41']}
      >
        {columnSample({
          header: 'Typ',
          minWidth: 'min-w-40',
          sortable: true,
          rows: ['Wypłata', 'Zaliczka'],
        })}
      </AuditVariant>
    </AuditGroup>
  )
}
