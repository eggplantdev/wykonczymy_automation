'use client'

import { Badge } from '@/components/ui/badge'
import { CARD_LIST_CLASS, CARD_SHELL_CLASS } from '@/components/ui/panel'
import { EYEBROW_CLASS, SUBSECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'
import { COLUMN_BORDERS, MOCK, MockTable, ParagonRow, SURFACE } from './a33-review-flows-shared'

export function A33TableGroup() {
  return (
    <AuditGroup
      id="A33.5"
      title="Tabela / lista pozycji"
      count="8 ekranów · 8 wersji"
      drift={[
        'Kształt: zwijane wiersze z Separatorem bg-foreground (a), tabela xs z pionowymi liniami między kolumnami (b), DataTable sm bez linii (c, d, e, g, h), karty CARD_SHELL na telefon (f).',
        'Te same dane, różne nagłówki: „Wysłano” / „Data zgłoszenia” / „Data”, „Pracownik” / „Kto”, „Załączniki” / „Podgląd”, „Decyzja” / „Weryfikował”, „Paragony” / „Status”.',
        'Kwota do prawej (meta align: right) w duplikatach (a) i „Transakcje” (e), ale „Kwota” w h nie ma align i stoi do lewej.',
        'Kolumna inwestycji: pierwsza (c), druga (e, g), siódma (h); pracownik: pierwszy (e), drugi (c), trzeci po select i akcjach (g).',
        'b ma dwie tabele w jednym dialogu z różnymi kolumnami i nagłówkami z opisem pod tytułem („ile jest aktualnie zgłoszone”) — żadna inna tabela tego nie robi.',
      ]}
      proposal={
        <>
          <code>ReviewLines</code> — DataTable z jedną konwencją kolumn kolejki (select · Pracownik
          · Inwestycja · Wysłano · Załączniki · Status · Decyzja · Akcje) i słownikiem nagłówków;
          kwoty zawsze przez kolumnę z <code>align: &apos;right&apos;</code>; na telefonie karty jak
          w f.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label={`${SURFACE.a}: paragony jako CollapsibleLineItem przedzielone Separatorem bg-foreground; decydowane wyszarzone (opacity-60), odrzucone przekreślone; duplikaty w DataTable xs`}
        sources={[
          'src/components/forms/expense-form/line-items-field.tsx:340',
          'src/components/forms/expense-form/line-items-field.tsx:379',
          'src/components/forms/expense-form/collapsible-line-item.tsx:37',
          'src/components/worker-expenses/expense-draft-duplicate-hints.tsx:113',
          'src/components/tables/expense-duplicates.tsx:47',
        ]}
      >
        <div className={MOCK}>
          <div className="space-y-6">
            <ParagonRow title="1. Castorama · 412,30 zł" status="pending" />
            <Separator orientation="horizontal" className="bg-foreground" />
            <ParagonRow title="2. Leroy Merlin · 88,00 zł" status="rejected" />
            <Separator orientation="horizontal" className="bg-foreground" />
            <ParagonRow title="3. Orlen · 250,00 zł" status="accepted" />
          </div>
          <section className="flex flex-col gap-1.5 pb-3">
            <h3 className={SUBSECTION_TITLE_CLASS}>Możliwe duplikaty</h3>
            <MockTable
              textSize="xs"
              columns={[
                { header: 'Akcje' },
                { header: 'Status' },
                { header: 'Pasuje do' },
                { header: 'Data' },
                { header: 'Kwota', align: 'right' },
                { header: 'Podgląd', align: 'center' },
                { header: 'Inwestycja' },
                { header: 'Kto' },
                { header: 'Kasa' },
                { header: 'Dokument' },
              ]}
              rows={[
                {
                  cells: [
                    '…',
                    'Ta sama kwota',
                    'Transakcja #4182',
                    '18.10.2026',
                    '412,30 zł',
                    '…',
                    'Mokotów, Puławska 12',
                    'Jan Kowalski',
                    'Kasa główna',
                    'FV 12/10/2026',
                  ],
                },
              ]}
            />
          </section>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label={`${SURFACE.b}: tabela xs z COLUMN_BORDERS, nagłówek sekcji jako eyebrow; kolumny rozpiski w kolejności (opis pod nagłówkiem, gdy jest)`}
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:536',
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:552',
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:589',
        ]}
      >
        <MockTable
          textSize="xs"
          className={cn(COLUMN_BORDERS, 'w-full')}
          toolbar={
            <div className="flex items-end justify-between gap-4">
              <h4 className={EYEBROW_CLASS}>Z rozpiski (1 z 4)</h4>
            </div>
          }
          columns={[
            { header: '✓', align: 'center' },
            { header: 'Nr' },
            { header: 'Sekcja' },
            { header: 'Opis prac' },
            {
              header: 'Pomiar z natury',
              align: 'center',
              description: 'ile jest aktualnie zgłoszone',
            },
            { header: 'Zgłoszono', align: 'center' },
            { header: 'Przyjmuję', align: 'center' },
            { header: 'Etap 2', align: 'center' },
            { header: 'Pomiar z natury', align: 'center', description: 'po przyjęciu zgłoszenia' },
            { header: 'Aktualizacja przedmiaru', align: 'center' },
            { header: 'Pomiar z natury / Aktualizacja przedmiaru', align: 'center' },
            { header: 'Akcje', align: 'center' },
          ]}
          rows={[
            {
              className: 'bg-primary/5',
              cells: [
                '✓',
                '2.4',
                'Ściany',
                'Gładź gipsowa ścian',
                '40',
                '24,5',
                '24,5',
                '12',
                '64,5',
                '—',
                '64,5 / 80',
                '…',
              ],
            },
          ]}
        />
      </AuditVariant>

      <AuditVariant
        letter="c"
        label={`${SURFACE.c}: DataTable sm — Inwestycja · Pracownik · Wysłano · Źródło · Prace (prawo) · Status · Weryfikował · Podgląd`}
        sources={[
          'src/components/tables/worker-reports.tsx:33',
          'src/components/tables/worker-reports.tsx:86',
        ]}
      >
        <MockTable
          columns={[
            { header: 'Inwestycja' },
            { header: 'Pracownik' },
            { header: 'Wysłano' },
            { header: 'Źródło' },
            { header: 'Prace', align: 'right' },
            { header: 'Status' },
            { header: 'Weryfikował' },
            { header: 'Podgląd' },
          ]}
          rows={[
            {
              cells: [
                'Mokotów, Puławska 12',
                'Jan Kowalski',
                '20.10.2026, 14:05',
                'z linku',
                '5',
                '…',
                '—',
                '…',
              ],
            },
          ]}
        />
      </AuditVariant>

      <AuditVariant
        letter="d"
        label={`${SURFACE.d}: DataTable sm, 12 kolumn — select na początku, „Akcje” do prawej na końcu`}
        sources={['src/components/tables/leads.tsx:43', 'src/components/tables/leads.tsx:140']}
      >
        <MockTable
          columns={[
            { header: '☐' },
            { header: 'Imię i nazwisko' },
            { header: 'Źródło' },
            { header: 'Email' },
            { header: 'Telefon' },
            { header: 'Formularz' },
            { header: 'Data zgłoszenia' },
            { header: 'Status kontaktu' },
            { header: 'Odpowiedzi' },
            { header: 'Załączniki' },
            { header: 'Inwestycja' },
            { header: 'Akcje', align: 'right' },
          ]}
          rows={[
            {
              cells: [
                '☐',
                'Ewa Lewandowska',
                'Facebook',
                'ewa.l@example.com',
                '600 100 200',
                'Remont łazienki',
                '19.10.2026',
                '…',
                '…',
                '…',
                '…',
                '…',
              ],
            },
          ]}
        />
      </AuditVariant>

      <AuditVariant
        letter="e"
        label={`${SURFACE.e}: DataTable sm — Pracownik · Inwestycja · Wysłano · Załączniki (środek) · Notatka · Status · Decyzja · Transakcje (prawo) · kolumna akcji bez nagłówka`}
        sources={[
          'src/components/tables/expense-drafts.tsx:109',
          'src/components/tables/expense-drafts.tsx:194',
        ]}
      >
        <MockTable
          columns={[
            { header: 'Pracownik' },
            { header: 'Inwestycja' },
            { header: 'Wysłano' },
            { header: 'Załączniki', align: 'center' },
            { header: 'Notatka' },
            { header: 'Status' },
            { header: 'Decyzja' },
            { header: 'Transakcje', align: 'right' },
            { header: '' },
          ]}
          rows={[
            {
              cells: [
                'Jan Kowalski',
                'Mokotów, Puławska 12',
                '18.10.2026, 11:20',
                '…',
                'Castorama i Orlen',
                '…',
                '18.10.2026, 15:02 · Marek Zieliński',
                '750,30 zł',
                '…',
              ],
            },
          ]}
        />
      </AuditVariant>

      <AuditVariant
        letter="f"
        label={`${SURFACE.f}: lista kart CARD_LIST / CARD_SHELL — inwestycja i data w pierwszym wierszu, kwota text-lg z badge w drugim, opis line-clamp-3`}
        sources={[
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:51',
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:53',
        ]}
      >
        <ul className={cn(CARD_LIST_CLASS, 'w-full sm:max-w-lg')}>
          <li className={cn('flex flex-col gap-3 p-4', CARD_SHELL_CLASS)}>
            <header className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 truncate text-sm font-medium">Mokotów, Puławska 12</span>
                <span className="text-muted-foreground ml-auto shrink-0 text-xs">20.10.2026</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold tabular-nums">1 200,00 zł</span>
                <div className="ml-auto shrink-0">
                  <Badge tone="pending">Czeka na potwierdzenie</Badge>
                </div>
              </div>
            </header>
            <p className="line-clamp-3 text-sm break-words whitespace-pre-line">
              Wypłata za gładzie, tydzień 42
            </p>
          </li>
        </ul>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label={`${SURFACE.g}: DataTable sm — select · Podgląd (akcja) · Pracownik · Inwestycja · Wysłano · Załączniki · Notatka · Paragony`}
        sources={[
          'src/components/tables/expense-drafts.tsx:70',
          'src/components/tables/expense-drafts.tsx:157',
        ]}
      >
        <MockTable
          columns={[
            { header: '☐' },
            { header: 'Podgląd' },
            { header: 'Pracownik' },
            { header: 'Inwestycja' },
            { header: 'Wysłano' },
            { header: 'Załączniki', align: 'center' },
            { header: 'Notatka' },
            { header: 'Paragony' },
          ]}
          rows={[
            {
              cells: [
                '☐',
                '…',
                'Jan Kowalski',
                'Mokotów, Puławska 12',
                '20.10.2026, 10:05',
                '…',
                'Castorama',
                '…',
              ],
            },
          ]}
        />
      </AuditVariant>

      <AuditVariant
        letter="h"
        label={`${SURFACE.h}: DataTable sm, 11 kolumn — „Anuluj” pierwsza, „Kwota” bez align (do lewej), „Powód” i „Odrzucono” na końcu`}
        sources={[
          'src/components/receipt-confirmation/rejected-receipts.tsx:21',
          'src/components/receipt-confirmation/rejected-receipts.tsx:57',
        ]}
      >
        <MockTable
          columns={[
            { header: 'Anuluj' },
            { header: 'ID' },
            { header: 'Data' },
            { header: 'Typ' },
            { header: 'Pracownik' },
            { header: 'Kwota' },
            { header: 'Inwestycja' },
            { header: 'Kasa' },
            { header: 'Opis' },
            { header: 'Powód' },
            { header: 'Odrzucono' },
          ]}
          rows={[
            {
              cells: [
                '…',
                '#5120',
                '19.10.2026',
                'Wypłata',
                'Jan Kowalski',
                '1 200,00 zł',
                'Mokotów, Puławska 12',
                'Kasa główna',
                'Wypłata za gładzie, tydzień 42',
                'Brakuje 100 zł',
                '19.10.2026, 18:40',
              ],
            },
          ]}
        />
      </AuditVariant>
    </AuditGroup>
  )
}
