/* eslint-disable local/no-hand-rolled-ui -- audit page renders verbatim copies of hand-rolled markup */
'use client'

import {
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FileText,
  Paperclip,
  Plus,
  Trash2,
  WandSparkles,
} from 'lucide-react'
import { OpenPreview } from '@/app/(frontend)/design/open-preview'
import { Badge, BadgeButton } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DecisionProgressBadge } from '@/components/ui/decision-progress-badge'
import { Description } from '@/components/ui/description'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { BORDERED_LIST_CLASS, CARD_LIST_CLASS, CARD_SHELL_CLASS } from '@/components/ui/panel'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import {
  EYEBROW_CLASS,
  SECTION_TITLE_MD_CLASS,
  SUBSECTION_TITLE_CLASS,
} from '@/components/ui/section-header'
import { Separator } from '@/components/ui/separator'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'
import {
  COLUMN_BORDERS,
  MOCK,
  MockTable,
  PARAGON_FOOTER_CLASS,
  ParagonRow,
  SURFACE,
  noop,
} from './a33-review-flows-shared'

const PAGE_RESET = 'p-0 sm:p-0 lg:p-0'

function FilterTrigger({ label }: { label: string }) {
  return (
    <Button variant="outline" size="sm">
      {label}
      <ChevronDown />
    </Button>
  )
}

function QueueFiltersMock({ extra }: { extra?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterTrigger label="Status" />
      <FilterTrigger label="Inwestycja" />
      <FilterTrigger label="Pracownik" />
      <FilterTrigger label="Od – do" />
      {extra && (
        <Button variant="outline" size="sm">
          <Copy />
          {extra}
        </Button>
      )}
    </div>
  )
}

function PreviewIcon() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-foreground mx-auto"
    >
      <FileText />
    </Button>
  )
}

function VerifyButton() {
  return (
    <Button size="xs">
      <Eye />
      Zweryfikuj
    </Button>
  )
}

export function A33ScreensGroup() {
  return (
    <AuditGroup
      id="A33"
      title="Przegląd i akceptacja — całe ekrany"
      count="8 ekranów · 8 wersji"
      drift={[
        'Kształt: dwa dialogi (wydatki — lista paragonów jako zwijane wiersze; prace — tabela xs z obramowaniem kolumn), pięć tabel DataTable sm, jedna lista kart (wypłaty pracownika).',
        'Decyzja zapada w trzech miejscach: przy wierszu i od razu na serwer (paragony, wypłaty), zbiorczo jednym przyciskiem w stopce (prace), albo wcale na ekranie — kolejki tylko otwierają dialog (/zgloszenia-prac → kosztorys, kolejka wydatków → dialog a).',
        'Odrzucenie z powodem istnieje tylko przy wypłatach (pracownik) i przy anulowaniu odrzuconych wypłat (kierownik); paragony, całe zgłoszenie wydatków i pozycje prac odrzuca się bez słowa wyjaśnienia.',
        'Kolumna akcji: pierwsza (kolejka wydatków „Podgląd”, odrzucone wypłaty „Anuluj”, prace spoza rozpiski i duplikaty „Akcje”) albo ostatnia (/zgloszenia-prac „Podgląd”, historia wydatków bez nagłówka, zapytania „Akcje” do prawej, rozpiska „Akcje” pośrodku).',
        'Nagłówek: tytuł strony h1 (c, d, e), CollapsibleSection sm (g, h) albo domyślna (f), tytuł dialogu (a z imieniem, b ogólny „Zgłoszenia prac” + imię w h3 wewnątrz).',
      ]}
      proposal={
        <>
          Jedna powłoka <code>ReviewSurface</code> z wymiennymi slotami: <code>ReviewHeader</code>{' '}
          (tytuł, licznik <code>DecisionProgressBadge</code>, „Wysłano · sprawdzono”),{' '}
          <code>ReviewLines</code> (tabela albo karty na telefonie), <code>ReviewActions</code> przy
          wierszu, <code>ReviewBulkBar</code> w sticky stopce, <code>RejectReasonDialog</code> dla
          każdego odrzucenia i <code>ReviewEmptyState</code>. Kolejki (c, e, g) zostają tabelami z
          jedną kolumną akcji „Akcje” na końcu.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label={`${SURFACE.a}: paragony jako zwijane wiersze z Przyjmij/Odrzuć, ramka „Możliwe duplikaty” z pełnymi kolumnami, sticky stopka zbiorcza; obok tryb bez paragonów (Zapisz + Odrzuć) i potwierdzenie odrzucenia`}
        sources={[
          'src/components/worker-expenses/use-expense-draft-acceptance.tsx:209',
          'src/components/worker-expenses/use-expense-draft-acceptance.tsx:275',
          'src/components/worker-expenses/use-expense-draft-acceptance.tsx:290',
          'src/components/forms/expense-form/expense-form.tsx:491',
          'src/components/forms/expense-form/expense-form.tsx:499',
          'src/components/forms/expense-form/line-items-field.tsx:303',
          'src/components/forms/expense-form/line-items-field.tsx:340',
          'src/components/forms/expense-form/line-items-field.tsx:379',
          'src/components/forms/expense-form/collapsible-line-item.tsx:37',
          'src/components/forms/expense-form/paragon-footer.tsx:36',
          'src/components/forms/expense-form/receipt-selection-actions.tsx:17',
          'src/components/worker-expenses/expense-draft-duplicate-hints.tsx:86',
          'src/components/worker-expenses/expense-draft-duplicate-hints.tsx:105',
          'src/components/tables/expense-duplicates.tsx:47',
          'src/components/worker-expenses/expense-draft-duplicate-status.tsx:14',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-2xl">
              <DialogHeader
                title="Zgłoszenie wydatków · Jan Kowalski"
                description="Paragony z Castoramy, budowa na Mokotowie"
              />
              <div className="space-y-6">
                <div className="border-destructive rounded-lg border-2 p-3">
                  <ParagonRow
                    title="1. Castorama · 412,30 zł"
                    status="pending"
                    leading={<Checkbox aria-label="Zaznacz pozycję 1" checked />}
                    action={
                      <div className="flex shrink-0 gap-2">
                        <Button type="button" size="sm">
                          Przyjmij
                        </Button>
                        <Button type="button" variant="destructive" size="sm">
                          Odrzuć
                        </Button>
                      </div>
                    }
                  />
                  <section className="flex flex-col gap-1.5 pt-3 pb-3">
                    <h3 className={cn(SUBSECTION_TITLE_CLASS, 'text-destructive')}>
                      Możliwe duplikaty
                    </h3>
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
                            <div key="actions" className="flex gap-2">
                              <Button type="button" size="xs" variant="outline">
                                OK, to nie duplikat
                              </Button>
                              <Button type="button" size="xs" variant="destructive">
                                Duplikat
                              </Button>
                            </div>,
                            <span
                              key="status"
                              className="text-destructive font-medium whitespace-nowrap"
                            >
                              Ten sam numer
                            </span>,
                            'Transakcja #4182',
                            '18.10.2026',
                            '412,30 zł',
                            <PreviewIcon key="preview" />,
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
                <Separator orientation="horizontal" className="bg-foreground" />
                <ParagonRow
                  title="2. Leroy Merlin · 88,00 zł"
                  status="rejected"
                  action={
                    <Button type="button" variant="outline" size="sm">
                      Cofnij
                    </Button>
                  }
                />
                <Separator orientation="horizontal" className="bg-foreground" />
                <ParagonRow title="3. Orlen · 250,00 zł" status="accepted" />
              </div>
              <div className={PARAGON_FOOTER_CLASS}>
                <div className="space-y-2">
                  <DecisionProgressBadge accepted={1} rejected={1} pending={2} onToggle={noop} />
                  <Description size="xs">
                    Kliknij etykietę, aby ukryć lub pokazać te paragony.
                  </Description>
                </div>
                <div className="ml-auto flex flex-col items-end gap-2">
                  <p className="text-sm leading-none font-medium">
                    Suma zaznaczonych (1): 412,30 zł
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button type="button" size="sm">
                      Przyjmij zaznaczone
                    </Button>
                    <Button type="button" variant="destructive" size="sm">
                      Odrzuć zaznaczone
                    </Button>
                    <Button type="button" variant="outline" size="sm">
                      Połącz zaznaczone w 1 transakcję
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-2xl">
              <DialogHeader
                title="Zgłoszenie wydatków · Anna Nowak"
                description="Taksówka z hurtowni"
              />
              <Description tone="warning">
                Nie udało się pobrać zdjęć — zgłoszenie można tylko odrzucić.
              </Description>
              <div className="flex flex-wrap items-center gap-2">
                <Description tone="error">Nie udało się sprawdzić duplikatów.</Description>
                <Button type="button" variant="outline" size="sm">
                  Sprawdź ponownie
                </Button>
              </div>
              <div className="mt-6">
                <footer>
                  <div className="flex items-center gap-4">
                    <Button type="submit">Zapisz</Button>
                    <Button type="button" variant="destructive" className="ml-auto">
                      Odrzuć
                    </Button>
                  </div>
                </footer>
              </div>
            </DialogContent>
          </Dialog>
          <ConfirmDialog
            open
            title="Odrzucić zgłoszenie?"
            description="Anna Nowak · Bez inwestycji"
            confirmLabel="Odrzuć"
            onConfirm={noop}
            onCancel={noop}
          />
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label={`${SURFACE.b}: lista zgłoszeń (wg daty / pracownika), potem przegląd — nagłówek z imieniem, pasek narzędzi, grupy „Spoza rozpiski” i „Z rozpiski” (tabele xs z obramowaniem kolumn; nagłówki pionowe spłaszczone), stopka ze zdaniem i jednym „Przyjmij”`}
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-dialog.tsx:39',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-dialog.tsx:52',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-list.tsx:30',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-list.tsx:40',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-list.tsx:53',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:304',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:358',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:396',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:451',
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:536',
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:552',
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:589',
          'src/components/worker-reports/worker-report-status-badge.tsx:36',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-3xl sm:max-h-[95vh]">
              <DialogHeader title="Zgłoszenia prac" />
              <div className="flex min-h-0 flex-col gap-3">
                <ToggleGroup
                  options={[
                    { value: 'date', label: 'Wg daty' },
                    { value: 'worker', label: 'Wg pracownika' },
                  ]}
                  value="date"
                  onChange={noop}
                  variant="muted"
                />
                <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
                  <section>
                    <h3 className={cn(EYEBROW_CLASS, 'mb-1')}>20.10.2026</h3>
                    <ul className={BORDERED_LIST_CLASS}>
                      {[
                        {
                          name: 'Jan Kowalski',
                          stage: 'Etap 2',
                          count: '5 pozycji',
                          isMixed: true,
                        },
                        {
                          name: 'Piotr Wiśniewski',
                          stage: undefined,
                          count: '2 pozycje',
                          isMixed: false,
                        },
                      ].map((report) => (
                        <li key={report.name}>
                          <Button
                            variant="ghost"
                            size="listRow"
                            align="start"
                            className="hover:bg-muted/50 gap-3 py-2.5 text-left"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="font-medium">{report.name}</span>
                              {report.stage && (
                                <span className="text-muted-foreground"> · do: {report.stage}</span>
                              )}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {report.count}
                            </span>
                            {report.isMixed ? (
                              <DecisionProgressBadge accepted={2} rejected={1} pending={2} />
                            ) : (
                              <DecisionProgressBadge accepted={0} rejected={0} pending={2} />
                            )}
                            <ChevronRight className="text-muted-foreground size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-3xl sm:max-h-[95vh]">
              <DialogHeader title="Zgłoszenia prac" />
              <div className="worker-report flex min-h-0 flex-col gap-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={SECTION_TITLE_MD_CLASS}>Jan Kowalski</h3>
                      <DecisionProgressBadge accepted={0} rejected={0} pending={5} />
                    </div>
                    <Description withIcon={false} size="xs">
                      Wysłano 20.10.2026, 14:05
                    </Description>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <Label className="gap-2 text-sm font-normal">
                      Dodaj do
                      <SimpleSelect
                        value="2"
                        onValueChange={noop}
                        options={[
                          { value: '2', label: 'Etap 2 — Gładzie' },
                          { value: 'new', label: 'Nowy etap' },
                        ]}
                        className="w-56"
                      />
                    </Label>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input className="sm:w-64" placeholder="Szukaj po nr, sekcji lub opisie…" />
                  <Button variant="outline" size="sm">
                    Ukryj zweryfikowane
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="text-muted-foreground hover:text-foreground w-fit sm:ml-auto"
                  >
                    <FileText />
                    <span className="truncate">Zgłoszone prace</span>
                  </Button>
                </div>
                <div className="flex min-h-0 flex-col gap-6 overflow-y-auto pr-1">
                  <section>
                    <MockTable
                      textSize="xs"
                      className={COLUMN_BORDERS}
                      toolbar={
                        <div className="flex items-end justify-between gap-4">
                          <div className="min-w-0">
                            <h4 className={EYEBROW_CLASS}>Spoza rozpiski (1)</h4>
                            <Description withIcon={false} size="xs">
                              Pracownik podał tylko opis, j.m. i ilość. Dodaj pracę do rozpiski — z
                              katalogu albo jako nową — a przejdzie do „Z rozpiski”, gdzie ją
                              przyjmiesz.
                            </Description>
                          </div>
                        </div>
                      }
                      columns={[
                        { header: 'Akcje', align: 'center' },
                        { header: 'Opis prac' },
                        { header: 'Może chodzi o' },
                        { header: 'Zgłoszono', align: 'center' },
                      ]}
                      rows={[
                        {
                          cells: [
                            <Button
                              key="reject"
                              variant="ghost"
                              size="xs"
                              className="text-muted-foreground whitespace-nowrap"
                            >
                              Odrzuć
                            </Button>,
                            'Montaż listew przypodłogowych',
                            <Button key="add" variant="outline" size="xs">
                              <Plus />
                              Dodaj do rozpiski
                            </Button>,
                            '32 mb',
                          ],
                        },
                      ]}
                    />
                  </section>
                  <section>
                    <MockTable
                      textSize="xs"
                      className={COLUMN_BORDERS}
                      toolbar={
                        <div className="flex items-end justify-between gap-4">
                          <div className="min-w-0">
                            <h4 className={EYEBROW_CLASS}>Z rozpiski (2 z 4)</h4>
                            <Description withIcon={false} size="xs">
                              Przyjęta ilość dodaje się do wybranego etapu.
                            </Description>
                          </div>
                        </div>
                      }
                      columns={[
                        {
                          header: (
                            <Checkbox aria-label="Zaznacz wszystkie" checked="indeterminate" />
                          ),
                          align: 'center',
                        },
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
                        {
                          header: 'Pomiar z natury',
                          align: 'center',
                          description: 'po przyjęciu zgłoszenia',
                        },
                        { header: 'Aktualizacja przedmiaru', align: 'center' },
                        { header: 'Pomiar z natury / Aktualizacja przedmiaru', align: 'center' },
                        { header: 'Akcje', align: 'center' },
                      ]}
                      rows={[
                        {
                          className: 'bg-primary/5',
                          cells: [
                            <Checkbox
                              key="tick"
                              aria-label="Przyjmij: Gładź gipsowa ścian"
                              checked
                            />,
                            '2.4',
                            'Ściany',
                            'Gładź gipsowa ścian',
                            '40',
                            '24,5',
                            <Input
                              key="qty"
                              className="mx-auto h-8 w-20 tabular-nums"
                              defaultValue="24,5"
                            />,
                            '12',
                            '40 → 64,5',
                            '—',
                            '64,5 / 80',
                            <Button
                              key="reject"
                              variant="ghost"
                              size="xs"
                              className="text-muted-foreground whitespace-nowrap"
                            >
                              Odrzuć
                            </Button>,
                          ],
                        },
                        {
                          className: 'bg-destructive/5',
                          cells: [
                            <Checkbox
                              key="tick"
                              aria-label="Przyjmij: Malowanie sufitu"
                              checked={false}
                            />,
                            '3.1',
                            'Sufity',
                            'Malowanie sufitu',
                            '0',
                            '18',
                            <Input
                              key="qty"
                              className="mx-auto h-8 w-20 tabular-nums"
                              defaultValue=""
                            />,
                            '0',
                            '0',
                            '—',
                            '0 / 18',
                            <Button
                              key="reject"
                              variant="ghost"
                              size="xs"
                              aria-pressed
                              className="text-destructive whitespace-nowrap"
                            >
                              Odrzucona · cofnij
                            </Button>,
                          ],
                        },
                      ]}
                    />
                  </section>
                </div>
              </div>
              <DialogFooter>
                <p className="text-foreground mr-auto self-center text-sm">Rozpatrzono 2 z 5.</p>
                <Button>Przyjmij 1 pozycję</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ConfirmDialog
            open
            title="Zamknąć bez zapisywania?"
            description="Zmiany w tym zgłoszeniu nie zostały zapisane i przepadną."
            confirmLabel="Zamknij bez zapisywania"
            cancelLabel="Wróć do zgłoszenia"
            onConfirm={noop}
            onCancel={noop}
          />
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label={`${SURFACE.c}: h1 + opis, filtry kolejki (przybliżone przyciskami), pasek z „Wczytaj zgłoszenie z kartki (AI)”, tabela z „Podgląd” ostatnią kolumną; decyzji na stronie brak`}
        sources={[
          'src/app/(frontend)/zgloszenia-prac/page.tsx:23',
          'src/app/(frontend)/zgloszenia-prac/page.tsx:24',
          'src/components/worker-reports/worker-reports-data-table.tsx:56',
          'src/components/worker-reports/worker-reports-data-table.tsx:62',
          'src/components/worker-reports/scan-report-button.tsx:35',
          'src/components/tables/worker-reports.tsx:33',
          'src/components/tables/worker-reports.tsx:86',
          'src/components/worker-reports/worker-report-row-actions.tsx:29',
        ]}
      >
        <PageWrapper title="Zgłoszenia prac" className={PAGE_RESET}>
          <Description>
            Bez sortowania na górze zgłoszenia czekające na decyzję, niżej rozpatrzone — w nich też
            można jeszcze przyjąć odrzucone pozycje. „Podgląd” pokazuje zgłoszenie na miejscu, a
            „Otwórz w kosztorysie” otwiera rozpiskę inwestycji z tym zgłoszeniem.
          </Description>
          <QueueFiltersMock />
          <MockTable
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ai" size="sm" className="sm:ml-auto">
                  <WandSparkles className="text-neon-cyan" />
                  <span className="text-neon-cyan font-semibold">
                    Wczytaj zgłoszenie z kartki (AI)
                  </span>
                </Button>
              </div>
            }
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
                  <span key="count" className="tabular-nums">
                    5
                  </span>,
                  <DecisionProgressBadge key="status" accepted={0} rejected={0} pending={5} />,
                  '—',
                  <div key="actions" className="flex items-center gap-1">
                    <RowActionButton icon={Eye} label="Podgląd" />
                    <Button size="xs" variant="outline">
                      Otwórz w kosztorysie
                    </Button>
                  </div>,
                ],
              },
              {
                cells: [
                  'Wola, Górczewska 8',
                  'Piotr Wiśniewski',
                  '19.10.2026, 09:12',
                  'skan',
                  <span key="count" className="tabular-nums">
                    12
                  </span>,
                  <DecisionProgressBadge key="status" accepted={9} rejected={1} pending={2} />,
                  '19.10.2026, 16:30 · Marek Zieliński',
                  <div key="actions" className="flex items-center gap-1">
                    <RowActionButton icon={Eye} label="Podgląd" />
                    <Button size="xs" variant="outline">
                      Otwórz w kosztorysie
                    </Button>
                  </div>,
                ],
              },
            ]}
          />
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label={`${SURFACE.d}: h1 + „N nowych”, pasek (szukaj, „Bez plików”, „Do kosza (N)”), pełne 12 kolumn; karty odbiorców powiadomień pod tabelą pominięte`}
        sources={[
          'src/app/(frontend)/zgloszenia/page.tsx:37',
          'src/app/(frontend)/zgloszenia/page.tsx:38',
          'src/components/leads/leads-data-table.tsx:74',
          'src/components/leads/leads-data-table.tsx:80',
          'src/components/leads/trash-leads-button.tsx:35',
          'src/components/tables/leads.tsx:43',
          'src/components/tables/leads.tsx:108',
          'src/components/tables/leads.tsx:140',
          'src/components/leads/lead-answers-dialog.tsx:22',
          'src/components/leads/lead-assets-dialog.tsx:122',
          'src/components/leads/promote-lead-dialog.tsx:80',
        ]}
      >
        <PageWrapper title="Zapytania z formularzy" className={PAGE_RESET}>
          <Description>3 nowych</Description>
          <MockTable
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Input className="sm:w-64" placeholder="Szukaj zgłoszenia..." />
                <Button variant="outline" size="sm">
                  Bez plików
                </Button>
                <Button variant="outline" size="sm" className="sm:ml-auto">
                  <Trash2 />
                  Do kosza (1)
                </Button>
              </div>
            }
            columns={[
              {
                header: (
                  <Checkbox aria-label="Zaznacz wszystkie na stronie" checked="indeterminate" />
                ),
              },
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
                  <Checkbox key="select" aria-label="Zaznacz: Ewa Lewandowska" checked />,
                  'Ewa Lewandowska',
                  <Badge key="source" tone="sky">
                    Facebook
                  </Badge>,
                  'ewa.l@example.com',
                  '600 100 200',
                  'Remont łazienki',
                  '19.10.2026',
                  <BadgeButton key="status" tone="muted">
                    Oczekuje
                  </BadgeButton>,
                  <Button key="details" variant="outline" size="xs">
                    Szczegóły
                  </Button>,
                  <Button
                    key="assets"
                    variant="outline"
                    size="xs"
                    className="min-w-12"
                    aria-label="Załączniki (2)"
                  >
                    <Paperclip />2
                  </Button>,
                  <Button key="promote" variant="outline" size="xs">
                    Dodaj
                  </Button>,
                  <div key="actions" className="flex items-center justify-end gap-1">
                    <DeleteButton label="Usuń zgłoszenie" />
                  </div>,
                ],
              },
              {
                cells: [
                  <Checkbox key="select" aria-label="Zaznacz: Tomasz Kamiński" checked={false} />,
                  'Tomasz Kamiński',
                  <Badge key="source" tone="positive">
                    Strona WWW
                  </Badge>,
                  'tomasz.k@example.com',
                  '501 222 333',
                  'Wycena mieszkania',
                  '17.10.2026',
                  <BadgeButton key="status" tone="positive">
                    Skontaktowano
                  </BadgeButton>,
                  <Button key="details" variant="outline" size="xs">
                    Szczegóły
                  </Button>,
                  <Button
                    key="assets"
                    variant="outline"
                    size="xs"
                    className="min-w-12"
                    aria-label="Załączniki (0)"
                  >
                    <Paperclip />0
                  </Button>,
                  <span key="promote" className="text-sm underline-offset-4">
                    Wola, Górczewska 8
                  </span>,
                  <div key="actions" className="flex items-center justify-end gap-1">
                    <DeleteButton label="Usuń zgłoszenie" />
                  </div>,
                ],
              },
            ]}
          />
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label={`${SURFACE.e}: h1, nad tabelą kolejka g (tu pominięta), filtry z „Duplikaty”, historia z pełnymi kolumnami i akcjami w OSTATNIEJ kolumnie bez nagłówka`}
        sources={[
          'src/app/(frontend)/zgloszenia-wydatkow/page.tsx:30',
          'src/app/(frontend)/zgloszenia-wydatkow/page.tsx:36',
          'src/components/worker-expenses/expense-drafts-data-table.tsx:50',
          'src/components/worker-expenses/expense-drafts-data-table.tsx:77',
          'src/components/worker-expenses/expense-drafts-data-table.tsx:91',
          'src/components/tables/expense-drafts.tsx:109',
          'src/components/tables/expense-drafts.tsx:165',
          'src/components/tables/expense-drafts.tsx:194',
          'src/components/worker-expenses/restore-expense-draft-button.tsx:35',
          'src/components/worker-expenses/draft-status-badge.tsx:13',
        ]}
      >
        <PageWrapper title="Zgłoszenia wydatków" className={PAGE_RESET}>
          <QueueFiltersMock extra="Duplikaty" />
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
                  <PreviewIcon key="media" />,
                  'Castorama i Orlen',
                  <span key="status" className="flex flex-wrap items-center gap-2">
                    <DecisionProgressBadge accepted={3} rejected={1} pending={0} />
                  </span>,
                  '18.10.2026, 15:02 · Marek Zieliński',
                  '750,30 zł',
                  '',
                ],
              },
              {
                cells: [
                  'Anna Nowak',
                  'Bez inwestycji',
                  '17.10.2026, 08:45',
                  <PreviewIcon key="media" />,
                  '—',
                  <span key="status" className="flex flex-wrap items-center gap-2">
                    <Badge tone="muted">odrzucony</Badge>
                    <span className="text-destructive text-xs whitespace-nowrap">
                      Duplikat zgłoszenia #812
                    </span>
                  </span>,
                  '17.10.2026, 09:10 · Marek Zieliński',
                  '—',
                  <div key="actions" className="flex items-center gap-1">
                    <Button size="xs" variant="outline">
                      Przywróć
                    </Button>
                  </div>,
                ],
              },
              {
                cells: [
                  'Piotr Wiśniewski',
                  'Wola, Górczewska 8',
                  '20.10.2026, 07:30',
                  <PreviewIcon key="media" />,
                  'Farby',
                  <span key="status" className="flex flex-wrap items-center gap-2">
                    <Badge tone="pending">czeka</Badge>
                  </span>,
                  '—',
                  '—',
                  <div key="actions" className="flex items-center gap-1">
                    <VerifyButton />
                  </div>,
                ],
              },
            ]}
          />
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label={`${SURFACE.f}: dwie sekcje kart („Do potwierdzenia”, „Odrzucone” z powodem), greenOutline „Potwierdzam” + destructiveOutline „Odrzuć” (touch); potwierdzenie i odrzucenie z powodem (pole bez autoFocus z ReasonField)`}
        sources={[
          'src/app/(frontend)/pracownicy/[id]/page.tsx:168',
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:51',
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:86',
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:116',
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:127',
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:138',
          'src/components/receipt-confirmation/reject-receipt-dialog.tsx:45',
          'src/components/receipt-confirmation/payout-status-badge.tsx:15',
        ]}
      >
        <div className={MOCK}>
          <CollapsibleSection
            title="Do potwierdzenia"
            hint="Potwierdź, że dostałeś te pieniądze — albo odrzuć i napisz, czego brakuje."
            withSeparator={false}
            className="sm:max-w-lg"
          >
            <ul className={CARD_LIST_CLASS}>
              <li className={cn('flex flex-col gap-3 p-4', CARD_SHELL_CLASS)}>
                <header className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">
                      Mokotów, Puławska 12
                    </span>
                    <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                      20.10.2026
                    </span>
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
                <div className="mt-1 grid auto-cols-fr grid-flow-col gap-2">
                  <Button variant="greenOutline" size="touch">
                    <Check />
                    Potwierdzam
                  </Button>
                  <Button variant="destructiveOutline" size="touch">
                    <Trash2 />
                    Odrzuć
                  </Button>
                </div>
              </li>
            </ul>
          </CollapsibleSection>
          <CollapsibleSection
            title="Odrzucone"
            hint="Czekają na wyjaśnienie z kierownikiem. Nadal możesz je potwierdzić albo poczekać, aż kierownik je anuluje."
            withSeparator={false}
            className="sm:max-w-lg"
          >
            <ul className={CARD_LIST_CLASS}>
              <li className={cn('flex flex-col gap-3 p-4', CARD_SHELL_CLASS)}>
                <header className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">Bez inwestycji</span>
                    <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                      15.10.2026
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold tabular-nums">450,00 zł</span>
                    <div className="ml-auto shrink-0">
                      <Badge tone="negative">Odrzucona</Badge>
                    </div>
                  </div>
                </header>
                <Description withIcon={false} className="whitespace-pre-line">
                  Powód odrzucenia: Nie dostałem tej wypłaty
                </Description>
                <div className="mt-1 grid auto-cols-fr grid-flow-col gap-2">
                  <Button variant="greenOutline" size="touch">
                    <Check />
                    Potwierdzam
                  </Button>
                </div>
              </li>
            </ul>
          </CollapsibleSection>
          <OpenPreview>
            <ConfirmDialog
              open
              variant="neutral"
              title="Potwierdzasz odbiór?"
              description="Potwierdzasz, że dostałeś 1 200,00 zł."
              confirmLabel="Potwierdzam"
              onConfirm={noop}
              onCancel={noop}
            />
            <FormDialogShell
              open
              onOpenChange={noop}
              showCloseButton={false}
              title="Odrzucasz 1 200,00 zł"
              description="Napisz, czego brakuje — kierownik zobaczy ten powód."
              confirmLabel="Odrzuć"
              confirmVariant="destructive"
              confirmDisabled
              onConfirm={noop}
            >
              <div className="grid gap-2">
                <Label htmlFor="a33-screens-receipt-reason">Powód odrzucenia</Label>
                <Textarea
                  id="a33-screens-receipt-reason"
                  placeholder="Np. brakuje 100 zł"
                  rows={3}
                />
                <Description withIcon={false} size="xs">
                  Brakuje znaków: 3
                </Description>
              </div>
            </FormDialogShell>
          </OpenPreview>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label={`${SURFACE.g}: CollapsibleSection sm z „Połącz zgłoszenia (N)” w action, zaznaczanie + „Podgląd” jako PIERWSZE kolumny, „Paragony” jako licznik; na pulpicie i nad historią e`}
        sources={[
          'src/components/dashboard/manager-dashboard-panels.tsx:20',
          'src/app/(frontend)/zgloszenia-wydatkow/page.tsx:31',
          'src/components/worker-expenses/pending-expense-drafts.tsx:99',
          'src/components/worker-expenses/pending-expense-drafts.tsx:107',
          'src/components/worker-expenses/pending-expense-drafts.tsx:120',
          'src/components/worker-expenses/pending-expense-drafts.tsx:123',
          'src/components/tables/expense-drafts.tsx:70',
          'src/components/tables/expense-drafts.tsx:83',
          'src/components/tables/expense-drafts.tsx:157',
          'src/components/worker-expenses/open-expense-draft-button.tsx:14',
        ]}
      >
        <div className={MOCK}>
          <CollapsibleSection
            title="Wydatki do sprawdzenia"
            hint="Zaznacz kilka zgłoszeń jednego pracownika, z tą samą inwestycją i kasą, aby połączyć je w jedno."
            size="sm"
            withSeparator={false}
            action={
              <Button type="button" size="sm" variant="outline">
                Połącz zgłoszenia (2)
              </Button>
            }
          >
            <MockTable
              columns={[
                { header: <Checkbox aria-label="Zaznacz wszystkie na stronie" checked /> },
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
                    <Checkbox key="select" aria-label="Zaznacz zgłoszenie Jan Kowalski" checked />,
                    <div key="actions" className="flex items-center gap-1">
                      <VerifyButton />
                    </div>,
                    'Jan Kowalski',
                    'Mokotów, Puławska 12',
                    '20.10.2026, 10:05',
                    <PreviewIcon key="media" />,
                    'Castorama',
                    <DecisionProgressBadge key="receipts" accepted={1} rejected={0} pending={3} />,
                  ],
                },
                {
                  cells: [
                    <Checkbox key="select" aria-label="Zaznacz zgłoszenie Jan Kowalski" checked />,
                    <div key="actions" className="flex items-center gap-1">
                      <VerifyButton />
                    </div>,
                    'Jan Kowalski',
                    'Mokotów, Puławska 12',
                    '20.10.2026, 12:40',
                    <PreviewIcon key="media" />,
                    '—',
                    '—',
                  ],
                },
              ]}
            />
          </CollapsibleSection>
          <OpenPreview>
            <ConfirmDialog
              open
              variant="neutral"
              title="Połączyć 2 zgłoszenia w jedno?"
              description="Paragony trafią do najstarszego zgłoszenia, pozostałe znikną. Tego nie da się cofnąć."
              confirmLabel="Połącz"
              onConfirm={noop}
              onCancel={noop}
            />
          </OpenPreview>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label={`${SURFACE.h}: CollapsibleSection sm na pulpicie kierownika, „Anuluj” PIERWSZĄ kolumną, pełne 11 kolumn z „Powód” jako zwykłym tekstem; anulowanie z wpisanym powodem`}
        sources={[
          'src/components/dashboard/manager-dashboard-panels.tsx:21',
          'src/components/receipt-confirmation/rejected-receipts.tsx:21',
          'src/components/receipt-confirmation/rejected-receipts.tsx:106',
          'src/components/transfers/cancel-transfer-button.tsx:68',
          'src/components/transfers/cancel-transfer-button.tsx:76',
        ]}
      >
        <div className={MOCK}>
          <CollapsibleSection
            title="Odrzucone przez pracowników"
            hint="Trzeba je wyjaśnić z pracownikiem lub anulować."
            size="sm"
            withSeparator={false}
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
                    <RowActionButton
                      key="cancel"
                      icon={Ban}
                      label="Anuluj transakcję"
                      text="Anuluj"
                      tone="destructive"
                    />,
                    '#5120',
                    '19.10.2026',
                    'Wypłata',
                    'Jan Kowalski',
                    '1 200,00 zł',
                    'Mokotów, Puławska 12',
                    'Kasa główna',
                    <span key="description" className="whitespace-pre-line">
                      Wypłata za gładzie, tydzień 42
                    </span>,
                    <span key="reason" className="whitespace-pre-line">
                      Brakuje 100 zł
                    </span>,
                    '19.10.2026, 18:40',
                  ],
                },
              ]}
            />
          </CollapsibleSection>
          <OpenPreview>
            <FormDialogShell
              open
              onOpenChange={noop}
              showCloseButton={false}
              title="Anulowanie transakcji"
              description="Czy na pewno chcesz anulować transakcję #5120? Operacja jest nieodwracalna."
              cancelLabel="Nie"
              confirmLabel="Tak, anuluj"
              confirmVariant="destructive"
              confirmDisabled
              onConfirm={noop}
            >
              <div className="grid gap-2">
                <Label htmlFor="a33-screens-cancel-reason">Powód anulowania (wymagany)</Label>
                <Textarea id="a33-screens-cancel-reason" placeholder="Min. 3 znaków" rows={3} />
                <Description withIcon={false} size="xs">
                  Brakuje 3 znaków
                </Description>
              </div>
            </FormDialogShell>
          </OpenPreview>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
