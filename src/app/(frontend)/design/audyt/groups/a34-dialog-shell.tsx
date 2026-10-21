'use client'

import { Download, Redo2, Trash2, Undo2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { OpenPreview } from '@/app/(frontend)/design/open-preview'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const noop = () => {}

const BODY = 'text-muted-foreground text-sm'
const ROWS = ['Łazienka — płytki', 'Kuchnia — zabudowa', 'Salon — malowanie', 'Przedpokój — listwy']

export function A34DialogShellGroup() {
  return (
    <AuditGroup
      id="A34"
      title="Oprawa dialogu"
      count="37 wystąpień w 37 plikach · 23 wersje"
      drift={[
        'Szerokość wpisywana klasą w każdym dialogu, 9 wariantów: dialog-sm (13), dialog — jawnie (3) albo domyślnie bez klasy (3 + FormDialog), dialog-lg (5), dialog-xl (4), dialog-3xl (3), dialog-md (1, plus 3 wywołania FormDialog), dialog-2xl (1), pełny ekran sm:max-w-none (1) i przełączana w locie sm:has-data-[step=form]:max-w-dialog-lg (1).',
        'Nagłówek wszędzie przez DialogHeader title, ale odstęp do treści już nie: bazowe gap-4, do tego mt-6 (FormDialog, rozliczenie wypłat, zamówienie), mt-2 (nowa praca, praca do katalogu), gap-8 (duplikaty, Telmak), gap-0 + px-4 pt-4 na sekcjach (pickery flush); FormDialog i zamówienie chowają nagłówek w dodatkowym <div>.',
        'Przewijanie na pięć sposobów: cały dialog (bazowe overflow-y-auto + sm:max-h-[90vh]), podbite sm:max-h-[94vh] / sm:max-h-[95vh], wewnętrzne max-h-dialog-scroll overflow-y-auto, wewnętrzne overflow-y-auto bez limitu (raz z min-h-0, raz bez), Panel sm:max-h-[60vh]; pickery flush mają overflow-hidden p-0 sm:p-0.',
        'Stopka: DialogActions (Anuluj + potwierdzenie, prawo) w 5 dialogach, ręczne DialogFooter z jednym przyciskiem bez „Anuluj” w 5, dwa przyciski size="sm" bez „Anuluj” w 1, FormFooter wyrównany do LEWEJ z mt-6 w dialogach z formularzem, flex justify-between z „Dodaj nową pracę…” po lewej w 2, zatwierdzenie w treści (w-full outline / size="sm") w 2, brak stopki w 12.',
        'Tekst w stopce: podsumowanie mr-auto self-center (zgłoszenia prac) vs Description tone="error" z sm:items-center sm:gap-3 (prace dodatkowe); stopka podglądu plików max-sm:hidden.',
        'Poza DialogContent: AlertDialog ma własną powierzchnię (zawsze p-6, border) i stopkę mt-4 sm:flex-wrap z trzema przyciskami, a menu mobilne to Sheet z ukrytym SheetTitle sr-only bez nagłówka i stopki.',
      ]}
      proposal={
        <>
          <code>DialogContent size=&quot;sm | md | lg | xl | 2xl | 3xl | full&quot;</code>{' '}
          (domyślnie <code>md</code>) zamiast klas <code>sm:max-w-dialog-*</code>, plus{' '}
          <code>flush</code> dla pickerów bez paddingu; przewija zawsze <code>DialogBody</code> (
          <code>min-h-0 overflow-y-auto</code>, nagłówek i stopka przypięte), a stopka to zawsze{' '}
          <code>DialogFooter</code>/<code>DialogActions</code> wyrównane do prawej w kolejności
          „Anuluj” → akcja poboczna → potwierdzenie, także dla formularzy (
          <code>FormFooter align=&quot;end&quot;</code>).
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="bez stopki — DialogHeader + treść, zamyka tylko X (sm ×5, dialog ×1, lg ×1, domyślna ×1; tu dialog-sm 420 px)"
        sources={[
          'src/components/pwa/install-app-button.tsx:55',
          'src/components/users/report-work-button.tsx:36',
          'src/components/dialogs/media-upload-dialog.tsx:46',
          'src/components/kosztorys/editor/dialogs/share/kosztorys-share-dialog.tsx:32',
          'src/components/kosztorys/editor/dialogs/share/kosztorys-worker-share-dialog.tsx:24',
          'src/components/kosztorys/editor/history/history-dialog.tsx:23',
          'src/components/leads/lead-answers-dialog.tsx:26',
          'src/components/company-knowledge/company-knowledge-dialog.tsx:17',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-sm" aria-describedby={undefined}>
              <DialogHeader title="Udostępnij inwestorowi" />
              <p className={BODY}>Treść dialogu — link, lista albo instrukcja.</p>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="DialogActions na końcu treści (Anuluj + potwierdzenie), cały dialog się przewija (lg ×2, xl ×1; tu dialog-lg 900 px)"
        sources={[
          'src/components/kosztorys/editor/dialogs/acceptance-protocol-dialog.tsx:62',
          'src/components/investments/contract-dialog.tsx:33',
          'src/components/kosztorys/editor/dialogs/report/sheet-report-dialog.tsx:37',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-lg">
              <DialogHeader
                title="Protokół odbioru prac"
                description="Sprawdź dane i wygeneruj protokół do druku lub zapisu jako PDF."
              />
              <p className={BODY}>Pola protokołu i tabela zakresu prac.</p>
              <DialogActions confirmLabel="Generuj" onConfirm={noop} onCancel={noop} />
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="DialogBody + DialogFooter z jednym przyciskiem, bez „Anuluj” (sm ×1, dialog ×1; tu dialog-sm)"
        sources={[
          'src/components/worker-expenses/expense-draft-dialog.tsx:135',
          'src/components/worker-reports/scan-report-dialog.tsx:159',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-sm" aria-describedby={undefined}>
              <DialogHeader title="Nowy wydatek" />
              <DialogBody>
                <Input placeholder="Wybierz inwestycję" />
                <Input placeholder="Notatka (opcjonalnie)" />
              </DialogBody>
              <DialogFooter>
                <Button>Wyślij</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="surowy div space-y-2 / space-y-4 text-sm zamiast DialogBody + DialogFooter z jednym przyciskiem (dialog-sm)"
        sources={[
          'src/components/dialogs/link-sheet-to-investment-dialog.tsx:53',
          'src/components/dialogs/add-sheet-dialog.tsx:64',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-sm">
              <DialogHeader title="Nowy kosztorys" description="Powiąż istniejący arkusz Google." />
              <div className="space-y-4 text-sm">
                <Input placeholder="https://docs.google.com/spreadsheets/d/…" />
              </div>
              <DialogFooter>
                <Button>Dodaj kosztorys</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="szerokie narzędzie: dialog-3xl (1800 px) gap-8 overflow-auto sm:max-h-[94vh], bez stopki"
        sources={[
          'src/components/transfers/duplicate-finder-dialog.tsx:100',
          'src/components/telmak-check/telmak-check-dialog.tsx:147',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent
              className="sm:max-w-dialog-3xl gap-8 overflow-auto sm:max-h-[94vh]"
              aria-describedby={undefined}
            >
              <DialogHeader title="Szukaj duplikatów" />
              <section className="flex flex-col gap-3">
                <span className={BODY}>Zakres dat i przycisk „Analizuj”.</span>
              </section>
              <section className="flex flex-col gap-2">
                <span className={BODY}>Tabele wyników.</span>
              </section>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="picker flush dialog-xl (1200 px): gap-0 overflow-hidden p-0, sekcje px-4, ręczna stopka justify-between + DialogActions p-0"
        sources={[
          'src/components/kosztorys/editor/dialogs/catalogue/add-items-from-catalogue-dialog.tsx:145',
          'src/components/kosztorys/editor/dialogs/worker-reports/catalogue-swap-dialog.tsx:72',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-xl gap-0 overflow-hidden p-0 sm:p-0">
              <DialogHeader className="px-4 pt-4" title="Dodaj pracę" />
              <div className="px-4 pt-3">
                <Input placeholder="Wybierz lub wpisz sekcję…" className="w-56" />
              </div>
              <div className="flex items-center gap-4 px-4 py-3">
                <Input placeholder="Szukaj pracy…" className="min-w-0 flex-1" />
              </div>
              <div className="min-h-0 px-4 pb-3">
                <Panel className="h-24" />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-4">
                <div className="flex items-center gap-2">
                  <Button>Dodaj nową pracę…</Button>
                </div>
                <DialogActions
                  className="p-0"
                  confirmLabel="Dodaj (2)"
                  onConfirm={noop}
                  onCancel={noop}
                />
              </div>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="formularz w div mt-2, domyślna szerokość (dialog 600 px), stopka formularza FormFooter mt-6 wyrównana do lewej (statyczna kopia)"
        sources={[
          'src/components/kosztorys/editor/dialogs/new-item/new-item-dialog.tsx:74',
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-item-from-kosztorys-dialog.tsx:59',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent>
              <DialogHeader title="Nowa praca" description="Na końcu sekcji „Łazienka”." />
              <div className="mt-2">
                <Input placeholder="Nazwa pracy" />
                <footer className="mt-6">
                  <div className="flex items-center gap-4">
                    <Button type="button">Dodaj</Button>
                  </div>
                </footer>
              </div>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="FormDialog (24 wywołania): wrapper div h-auto + DialogBody mt-6 pr-1, szerokość z className wywołującego (domyślna / md / lg / 2xl), FormFooter z lewej (statyczna kopia)"
        sources={['src/components/dialogs/form-dialog.tsx:58']}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-md">
              <div className="h-auto">
                <DialogHeader title="Nowa inwestycja" />
                <DialogBody className="mt-6 pr-1">
                  <Input placeholder="Nazwa inwestycji" />
                  <footer className="mt-6">
                    <div className="flex items-center gap-4">
                      <Button type="button">Zapisz</Button>
                    </div>
                  </footer>
                </DialogBody>
              </div>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="kopia FormDialog bez wrappera h-auto: DialogBody mt-6 pr-1, dialog-lg, FormFooter z lewej (statyczna kopia)"
        sources={['src/components/dialogs/settle-payouts-dialog.tsx:25']}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-lg">
              <DialogHeader title="Rozlicz wypłaty — Jan Kowalski" />
              <DialogBody className="mt-6 pr-1">
                <p className={BODY}>Tabela kwot do wypłaty.</p>
                <footer className="mt-6">
                  <div className="flex items-center gap-4">
                    <Button type="button">Wypłać</Button>
                  </div>
                </footer>
              </DialogBody>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="szerokość zależna od kroku (sm → sm:has-data-[step=form]:max-w-dialog-lg), nagłówek w div data-step, treść w div mt-6 pr-1"
        sources={['src/components/orders/order-dialog.tsx:54']}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-sm sm:has-data-[step=form]:max-w-dialog-lg">
              <div data-step="pick">
                <DialogHeader title="Zamówienie" description="Mokotów, ul. Puławska 12" />
                <div className="mt-6 pr-1">
                  <p className={BODY}>Wybór dostawcy i pracownika.</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="dialog-xl: pasek narzędzi + Panel min-h-0 overflow-y-auto sm:max-h-[60vh] + DialogActions"
        sources={['src/components/kosztorys/editor/dialogs/reorder/reorder-dialog.tsx:208']}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-xl">
              <DialogHeader
                title="Ustaw kolejność"
                description="Zaznacz prace i przeciągnij je w nowe miejsce."
              />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground mr-auto">Zaznaczone: 2</span>
                <Button size="sm" variant="ghost">
                  <Undo2 />
                  Cofnij
                </Button>
                <Button size="sm" variant="ghost">
                  <Redo2 />
                  Ponów
                </Button>
              </div>
              <Panel className="min-h-0 overflow-y-auto select-none max-sm:flex-1 sm:max-h-[60vh]">
                {ROWS.map((row) => (
                  <div key={row} className="border-b px-3 py-2 text-sm last:border-b-0">
                    {row}
                  </div>
                ))}
              </Panel>
              <DialogActions confirmLabel="Zapisz kolejność" onConfirm={noop} onCancel={noop} />
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="picker flush dialog-md (750 px): panel max-h-dialog-scroll mt-3 border-t, DialogActions px-4 pt-3 pb-4"
        sources={[
          'src/components/kosztorys/editor/dialogs/preset/add-sections-from-preset-dialog.tsx:99',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-md gap-0 overflow-hidden p-0 sm:p-0">
              <DialogHeader
                className="px-4 pt-4"
                title="Dodaj sekcję z szablonu"
                description="Wybierz sekcje z zapisanych szablonów."
              />
              <div className="max-h-dialog-scroll mt-3 flex min-h-0 border-t">
                <div className="min-h-0 flex-1 overflow-y-auto p-2 text-sm">Szablony</div>
                <div className="min-h-0 flex-1 overflow-y-auto border-l p-2 text-sm">Sekcje</div>
              </div>
              <DialogActions
                className="px-4 pt-3 pb-4"
                confirmLabel="Dodaj (3)"
                onConfirm={noop}
                onCancel={noop}
              />
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="m"
        label="dialog-3xl sm:max-h-[95vh], DialogFooter w zagnieżdżonym komponencie z podsumowaniem mr-auto po lewej"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-dialog.tsx:39',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-3xl sm:max-h-[95vh]">
              <DialogHeader title="Zgłoszenia prac" />
              <div>
                <p className={BODY}>Lista zgłoszeń i pozycje do przyjęcia.</p>
                <DialogFooter>
                  <p className="text-foreground mr-auto self-center text-sm">
                    3 przyjęte, 1 odrzucona
                  </p>
                  <Button>Przyjmij 3 pozycje</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="n"
        label="dialog-2xl (1400 px): wewnętrzne max-h-dialog-scroll overflow-y-auto pr-1, bez stopki"
        sources={['src/components/worker-reports/report-preview-dialog.tsx:25']}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-2xl">
              <DialogHeader title="Podgląd zgłoszenia" />
              <div className="flex min-h-0 flex-col gap-4">
                <span className="text-sm font-medium">Mokotów · Jan Kowalski</span>
                <div className="max-h-dialog-scroll flex min-h-0 flex-col gap-6 overflow-y-auto pr-1">
                  {ROWS.map((row) => (
                    <span key={row} className="text-sm">
                      {row}
                    </span>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="o"
        label="dialog-lg: max-h-dialog-scroll overflow-y-auto + DialogFooter sm:items-center sm:gap-3 z błędem po lewej"
        sources={['src/components/kosztorys/worker-report/extra-works-dialog-button.tsx:46']}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-lg">
              <DialogHeader title="Prace dodatkowe" description="Dopisz prace spoza kosztorysu." />
              <div className="max-h-dialog-scroll overflow-y-auto">
                <p className={BODY}>Wiersze prac dodatkowych.</p>
              </div>
              <DialogFooter className="sm:items-center sm:gap-3">
                <Description tone="error">Popraw zaznaczone wiersze.</Description>
                <Button>Gotowe</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="p"
        label='dialog-sm: div min-h-0 overflow-y-auto + DialogFooter z jednym przyciskiem size="sm"'
        sources={[
          'src/components/kosztorys/editor/dialogs/view-settings/kosztorys-worker-view-dialog.tsx:52',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-sm">
              <DialogHeader
                title="Ustawienia widoku pracownika"
                description="Zaznacz, które kolumny i pozycje widzą pracownicy."
              />
              <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
                <p className={BODY}>Kolumny i grupy pozycji.</p>
              </div>
              <DialogFooter>
                <Button size="sm">Zapisz</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="q"
        label="dialog-sm: div overflow-y-auto bez min-h-0, bez stopki"
        sources={['src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:87']}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-sm">
              <DialogHeader
                title="Wersje"
                description="Zapisane i automatyczne punkty przywracania."
              />
              <div className="flex flex-col gap-4 overflow-y-auto">
                {ROWS.slice(0, 2).map((row) => (
                  <Panel key={row} className="px-3 py-2 text-sm">
                    {row}
                  </Panel>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="r"
        label='dialog-sm: DialogFooter z dwoma przyciskami size="sm" (outline + główny), bez „Anuluj”'
        sources={[
          'src/components/kosztorys/editor/dialogs/view-settings/kosztorys-client-view-dialog.tsx:62',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-sm">
              <DialogHeader
                title="Ustawienia podglądu inwestora"
                description="Zaznacz, które kolumny i pozycje inwestor widzi w rozpisce."
              />
              <p className={BODY}>Kolumny i grupy pozycji.</p>
              <DialogFooter>
                <Button variant="outline" size="sm">
                  Zapisz jako domyślne
                </Button>
                <Button size="sm">Zapisz</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="s"
        label='dialog-sm: zatwierdzenie w treści — Button variant="outline" className="w-full", bez stopki'
        sources={['src/components/dialogs/sheet-setup-dialog.tsx:53']}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-sm">
              <DialogHeader
                title="Kosztorys inwestycji"
                description="Dodaj istniejący arkusz Google."
              />
              <div className="space-y-6 text-sm">
                <section className="space-y-2">
                  <Input placeholder="https://docs.google.com/spreadsheets/d/…" />
                  <Button variant="outline" className="w-full">
                    Dodaj kosztorys
                  </Button>
                </section>
              </div>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="t"
        label='dialog (600 px): przycisk akcji size="sm" w sekcji treści, bez stopki'
        sources={['src/components/leads/lead-assets-dialog.tsx:132']}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog">
              <DialogHeader
                title="Załączniki"
                description="Wybierz pliki i inwestycję, do której będą dodane."
              />
              <section className="space-y-2">
                <p className={BODY}>Miniatury plików do wyboru.</p>
                <Button size="sm">Dodaj do inwestycji (2)</Button>
              </section>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="u"
        label="pełny ekran: sm:max-w-none sm:rounded-none sm:translate-y-0, stopka max-sm:hidden (sm:h-dvh zastąpione h-80, żeby zmieścić w karcie)"
        sources={['src/components/media/media-preview-dialog.tsx:227']}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent
              className="h-80 sm:top-0 sm:max-h-none sm:max-w-none sm:translate-y-0 sm:rounded-none"
              aria-describedby={undefined}
            >
              <DialogHeader title="faktura-2026-10.pdf" />
              <div className="bg-muted relative flex min-h-0 w-full flex-1 items-center justify-center rounded-md" />
              <DialogFooter className="max-sm:hidden">
                <Button variant="outline">
                  <Download />
                  Pobierz
                </Button>
                <Button variant="destructive">
                  <Trash2 />
                  Usuń
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="v"
        label="AlertDialog: własna powierzchnia max-w-dialog-sm p-6 border, treść mt-4, stopka sm:flex-wrap z trzema przyciskami"
        sources={[
          'src/components/kosztorys/editor/dialogs/new-item/catalogue-collision-confirm.tsx:44',
        ]}
      >
        <OpenPreview>
          <AlertDialog>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>„Malowanie ścian” jest już w katalogu</AlertDialogTitle>
                <AlertDialogDescription>
                  Nadpisanie zmieni cenę j.m. z 25,00 zł na 28,00 zł.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="mt-4 space-y-3">
                <p className={BODY}>Ceny w katalogu i po nadpisaniu.</p>
              </div>
              <AlertDialogFooter className="sm:flex-wrap">
                <Button variant="outline">Wróć</Button>
                <Button variant="outline">Tylko do kosztorysu</Button>
                <Button variant="destructive">Nadpisz w katalogu</Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="w"
        label="Sheet menu mobilnego: SheetTitle sr-only, bez nagłówka i stopki, dolny blok mt-auto (pominięte sm:hidden, żeby był widoczny)"
        sources={['src/components/nav/mobile-nav.tsx:76']}
      >
        <OpenPreview>
          <Sheet>
            <SheetContent aria-describedby={undefined}>
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex shrink-0 items-start gap-3 px-3">
                <span className="py-2 text-lg font-semibold">Wykończymy</span>
              </div>
              <div className="flex flex-col gap-1 px-3 pt-2 text-sm">
                <span>Inwestycje</span>
                <span>Kasy</span>
              </div>
              <div className="mt-auto flex flex-col gap-2 px-3 pt-12 pb-4 text-sm">
                <span>Jan Kowalski</span>
              </div>
            </SheetContent>
          </Sheet>
        </OpenPreview>
      </AuditVariant>
    </AuditGroup>
  )
}
