import { CircleCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Description } from '@/components/ui/description'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Panel } from '@/components/ui/panel'
import { SUBSECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { SignedMoneyDisplay } from '@/components/ui/signed-money-display'
import { StatButton } from '@/components/ui/stat-button'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_NAME_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { ToggleStatButtons, type StatEntryT } from '@/components/ui/toggle-stat-buttons'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const TWO_COLS = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`
const THREE_COLS = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`
const FOUR_COLS = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`
const MARGIN_TABLE_COLS = `${SUMMARY_LABEL_COL} 17rem`
const NAME_COLS = `${SUMMARY_NAME_COL} ${SUMMARY_VALUE_COL}`

const TABLE = 'w-auto min-w-64 max-sm:text-xs'
const CELL = 'py-1.5 pl-7 first:pl-0'
const LABEL = cn(CELL, 'text-muted-foreground text-left')
const VALUE = cn(CELL, 'text-right font-medium whitespace-nowrap tabular-nums')
const HEAD = 'border-border text-muted-foreground border-b text-xs [&>td]:font-normal'
const GRAND =
  'border-foreground border-t text-base max-sm:text-sm [&>td]:pt-2.5 [&>td]:font-semibold'

const REPORT_TH_FIRST = 'py-1 font-normal text-left'
const REPORT_TH = 'py-1 font-normal pl-3 text-right'
const REPORT_ROW = 'border-border/60 border-t align-middle'
const REPORT_CELL = 'text-foreground py-1 pl-3 text-right tabular-nums'

const REGISTER_TYPE_ENTRIES: StatEntryT[] = [
  {
    label: 'Główna (1)',
    value: '12 345,67 zł',
    amount: 12345.67,
    borderClassName: 'border-chart-blue',
  },
  {
    label: 'Pomocnicza (2)',
    value: '1 111,11 zł',
    amount: 1111.11,
    borderClassName: 'border-chart-teal',
  },
  {
    label: 'Pracownicza (5)',
    value: '−88,00 zł',
    amount: -88,
    borderClassName: 'border-chart-orange',
  },
]

const OWN_REGISTER_ENTRIES: StatEntryT[] = [
  {
    label: 'Kasa Jana',
    value: '1 111,11 zł',
    amount: 1111.11,
    borderClassName: 'border-chart-turquoise',
  },
  {
    label: 'Kasa budowa',
    value: '−88,00 zł',
    amount: -88,
    borderClassName: 'border-chart-turquoise',
  },
]

const INVESTOR_ROWS: StatEntryT[][] = [
  [
    {
      label: 'Materiały budowlane',
      value: '8 000,00 zł',
      amount: -8000,
      borderClassName: 'border-chart-red',
    },
    { label: 'Inne', value: '1 111,11 zł', amount: -1111.11, borderClassName: 'border-chart-red' },
  ],
  [
    {
      label: 'Robocizna netto',
      value: '12 345,67 zł',
      amount: -12345.67,
      borderClassName: 'border-chart-orange',
      tooltip: 'Kwota, którą inwestor płaci firmie za pracę.',
    },
  ],
  [
    {
      label: 'Wpłaty',
      value: '20 000,00 zł',
      amount: 20000,
      borderClassName: 'border-chart-green',
      tooltip: 'Wpłaty inwestora, finansowanie firmy i inne wpłaty.',
    },
    {
      label: 'Rabat netto',
      value: '500,00 zł',
      amount: 500,
      borderClassName: 'border-chart-green',
      tooltip: 'Rabat na robociznę — podnosi bilans inwestora.',
    },
  ],
]

export function A35SummaryPanelsGroup() {
  return (
    <AuditGroup
      id="A35"
      title="Panele podsumowań"
      count="27 paneli w 22 plikach · 18 wersji"
      drift={[
        'Kontener: goła SummaryTable (siatka z obramowaniem komórek) vs Panel tone="muted" px-6 py-4 (saldo w formularzach) vs surowa <table> bez ramek (raport pracownika) vs ikonka statusu + tabela z liniami border-border/60 (raporty arkusza) vs siatka kafelków StatButton (ToggleStatButtons) vs sama linia „Saldo: …”.',
        'Tytuł: w lewej komórce nagłówka SummaryHeaderCell (text-xs, wyszarzony) vs osobny h2/h3 SUBSECTION_TITLE_CLASS nad tabelą (raz mb-2, raz gap-2 sekcji) vs tytuł CollapsibleSection vs p.font-medium obok ikonki vs Description nad kafelkami vs brak tytułu.',
        'Nagłówki kolumn: „Netto/Brutto” text-foreground font-bold (SummaryMoneyHeaders) vs zwykłe wyszarzone „Netto/Brutto” vs „Kwota” vs brak wiersza nagłówka (protokół, rozliczenie bez osi); kolumna wartości 9rem vs 17rem (marża) vs SUMMARY_NAME_COL (kasy).',
        'Wartości: zwykła waga + tabular-nums (SummaryCell) vs font-medium w każdej wartości (raport pracownika) vs font-semibold (SignedMoneyDisplay) vs font-medium tylko w „Suma wydatków”; kolor: tone="error" wg isNegativeMoney, danger w SummaryRow, ręczne text-chart-green/text-destructive, signedMoneyColor (dodatnie na zielono), wpłaty raz tone="success", raz bez koloru.',
        'Wiersz zamykający: font-bold („Razem”, „Marża”, „Pozostało…”) vs font-medium („Łącznie”, „Suma”) vs GRAND border-t text-base font-semibold vs linia SignedMoneyDisplay pod kafelkami; nadpłata jako minus z notką „nadpłacone” vs zmiana etykiety na „Nadpłata” z kwotą bez znaku vs „Pozostało do zapłaty*” z przypisem.',
        'Telefon: SummaryTable max-sm:text-xs + px-2 (ale kasy nadpisują text-sm), raport pracownika max-sm:text-xs z GRAND max-sm:text-sm, tabela porównania max-sm:text-xs + overflow-x-auto, kafelki max-sm:grid-cols-1; w-fit prawie wszędzie, ale „Podsumowanie” bez w-fit.',
      ]}
      proposal={
        <>
          <code>SummaryPanel</code> w <code>ui/summary-grid</code> (props: <code>title</code> zawsze
          w komórce nagłówka, <code>columns = ['Kwota']</code>,{' '}
          <code>rows: {'{ label, value | values, tone?, emphasis?, note? }'}</code>, opcjonalny{' '}
          <code>total</code> zawsze font-bold z kolorem znaku liczonym w środku,{' '}
          <code>caption</code>/<code>footnote</code>) — przechodzą na niego tabele kosztorysu,
          raport pracownika, protokół, koszty pojazdu i kasy pracownika; <code>InfoList</code>{' '}
          zostaje dla faktów nieliczbowych, a kafelki ToggleStatButtons i Panel salda w formularzu
          dostają ten sam wiersz sumy zamiast własnej linii SignedMoneyDisplay.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="raport arkusza — ikonka statusu + p.font-medium + werdykt + tabela porównania (Różnica text-warning / „zgadza się”)"
        sources={[
          'src/components/kosztorys/editor/dialogs/sheet/sheet-compare-dialog.tsx:121',
          'src/components/kosztorys/editor/dialogs/sheet/sheet-compare-dialog.tsx:179',
          'src/components/kosztorys/editor/dialogs/sheet/sheet-compare-dialog.tsx:222',
          'src/components/kosztorys/editor/dialogs/sheet/sheet-import-dialog.tsx:356',
        ]}
      >
        <div className="flex w-full flex-col gap-4">
          <div className="flex items-start gap-2">
            <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium">Kwoty</p>
              <p>Arkusz Google i aplikacja różnią się o 88,00 zł.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm max-sm:text-xs">
                  <thead>
                    <tr className="text-muted-foreground text-xs">
                      <th className={REPORT_TH_FIRST}></th>
                      <th className={REPORT_TH}>Arkusz Google</th>
                      <th className={REPORT_TH}>Ta aplikacja</th>
                      <th className={REPORT_TH}>Różnica</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={REPORT_ROW}>
                      <td className="py-1">Wartość prac wykonanych</td>
                      <td className={REPORT_CELL}>12 345,67 zł</td>
                      <td className={REPORT_CELL}>12 257,67 zł</td>
                      <td className={cn(REPORT_CELL, 'text-warning')}>88,00 zł</td>
                    </tr>
                    <tr className={REPORT_ROW}>
                      <td className="py-1">Nierozpisane na etapy</td>
                      <td className={REPORT_CELL}>1 111,11 zł</td>
                      <td className={REPORT_CELL}>1 111,11 zł</td>
                      <td className={cn(REPORT_CELL, 'text-muted-foreground')}>zgadza się</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CircleCheck className="text-chart-green mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium">Porównanie sum</p>
              <p>Podsumowanie arkusza Google zgadza się z tym, co policzyliśmy z jego prac.</p>
            </div>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="marża — Description max-w-xl nad tabelą, tytuł + „Kwota” w nagłówku, kolumna 17rem, SummaryRow (danger → error)"
        sources={[
          'src/components/kosztorys/summary/tables/margin-actual-table.tsx:44',
          'src/components/kosztorys/summary/tables/margin-actual-table.tsx:92',
          'src/components/kosztorys/summary/tables/margin-forecast-table.tsx:32',
        ]}
      >
        <div className="flex w-full flex-col gap-4">
          <Description className="max-w-xl" size="xs">
            Robocizna minus rabat minus suma wykonanej pracy, minus materiał wliczony w robociznę,
            stratę i premie.
          </Description>
          <SummaryTable cols={MARGIN_TABLE_COLS} className="w-fit">
            <SummaryHeaderCell>Marża rzeczywista</SummaryHeaderCell>
            <SummaryHeaderCell>Kwota</SummaryHeaderCell>
            <SummaryCell weight="default">Robocizna</SummaryCell>
            <SummaryCell weight="default" tone="default">
              12 345,67
            </SummaryCell>
            <SummaryCell weight="default">Rabat</SummaryCell>
            <SummaryCell weight="default" tone="success">
              −500,00
            </SummaryCell>
            <SummaryCell weight="default">Suma wykonanej pracy</SummaryCell>
            <SummaryCell weight="default" tone="success">
              −9 111,11
            </SummaryCell>
            <SummaryCell weight="bold">Marża</SummaryCell>
            <SummaryCell weight="bold" tone="default">
              2 734,56
            </SummaryCell>
          </SummaryTable>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="raport pracownika — surowa <table> bez ramek, HEAD border-b text-xs, wszystkie wartości font-medium, GRAND border-t text-base font-semibold"
        sources={[
          'src/components/kosztorys/worker-report/worker-summary.tsx:68',
          'src/components/kosztorys/worker-report/worker-summary.tsx:27',
          'src/components/kosztorys/worker-report/worker-summary.tsx:100',
        ]}
      >
        <div className="flex flex-col items-end gap-6">
          <table className={TABLE}>
            <tbody>
              <tr className={HEAD}>
                <td className={LABEL}>Twoje rozliczenie</td>
                <td className={VALUE}>Kwota netto</td>
              </tr>
              <tr>
                <td className={LABEL}>Wykonane razem</td>
                <td className={VALUE}>12 345,67 zł</td>
              </tr>
              <tr>
                <td className={LABEL}>Premia</td>
                <td className={VALUE}>500,00 zł</td>
              </tr>
              <tr>
                <td className={LABEL}>Wypłacone</td>
                <td className={cn(VALUE, 'text-chart-green')}>11 234,56 zł</td>
              </tr>
              <tr className={GRAND}>
                <td className={cn(CELL, 'text-left')}>Pozostało do wypłaty</td>
                <td className={VALUE}>1 611,11 zł</td>
              </tr>
            </tbody>
          </table>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="robocizna wg etapów / rozliczenie — tytuł w nagłówku + pogrubione „Netto/Brutto”, SummaryRow, „Razem” bold (w rozliczeniu tytuł pusty, a przy jednej osi nagłówka brak)"
        sources={[
          'src/components/kosztorys/summary/tabs/summary-stages-tab.tsx:47',
          'src/components/kosztorys/summary/tables/summary-totals-table.tsx:40',
        ]}
      >
        <SummaryTable cols={THREE_COLS} className="w-fit">
          <SummaryHeaderCell>Robocizna</SummaryHeaderCell>
          <SummaryHeaderCell className="text-foreground font-bold">Netto</SummaryHeaderCell>
          <SummaryHeaderCell className="text-foreground font-bold">Brutto</SummaryHeaderCell>
          <SummaryCell weight="default">Etap 1</SummaryCell>
          <SummaryCell weight="default" tone="default">
            1 111,11
          </SummaryCell>
          <SummaryCell weight="default" tone="default">
            1 200,00
          </SummaryCell>
          <SummaryCell weight="default">Etap 2</SummaryCell>
          <SummaryCell weight="default" tone="default">
            11 234,56
          </SummaryCell>
          <SummaryCell weight="default" tone="default">
            12 133,32
          </SummaryCell>
          <SummaryCell weight="bold">Razem</SummaryCell>
          <SummaryCell weight="bold" tone="default">
            12 345,67
          </SummaryCell>
          <SummaryCell weight="bold" tone="default">
            13 333,32
          </SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="saldo kasy — sama linia SignedMoneyDisplay („Saldo: …”, font-semibold, kolor wg znaku)"
        sources={[
          'src/app/(frontend)/kasa/[id]/page.tsx:68',
          'src/components/forms/settle-payouts-form/settle-payouts-form.tsx:206',
        ]}
      >
        <div className="flex flex-col gap-1">
          <SignedMoneyDisplay amount={12345.67} />
          <SignedMoneyDisplay amount={-88} label="Saldo po wypłacie" />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="„Podsumowanie” — jak d, ale bez w-fit i z „Łącznie” tylko font-medium"
        sources={['src/components/kosztorys/summary/tables/summary-breakdown-table.tsx:30']}
      >
        <SummaryTable cols={THREE_COLS}>
          <SummaryHeaderCell>Podsumowanie</SummaryHeaderCell>
          <SummaryHeaderCell className="text-foreground font-bold">Netto</SummaryHeaderCell>
          <SummaryHeaderCell className="text-foreground font-bold">Brutto</SummaryHeaderCell>
          <SummaryCell weight="default">Robocizna</SummaryCell>
          <SummaryCell weight="default" tone="default">
            12 345,67
          </SummaryCell>
          <SummaryCell weight="default" tone="default">
            13 333,32
          </SummaryCell>
          <SummaryCell weight="default">Rabat</SummaryCell>
          <SummaryCell weight="default" tone="success">
            −500,00
          </SummaryCell>
          <SummaryCell weight="default" tone="success">
            −540,00
          </SummaryCell>
          <SummaryCell weight="default">Materiały</SummaryCell>
          <SummaryCell weight="default" tone="default">
            1 111,11
          </SummaryCell>
          <SummaryCell weight="default" tone="default">
            1 366,67
          </SummaryCell>
          <SummaryCell weight="medium">Łącznie</SummaryCell>
          <SummaryCell weight="medium" tone="default">
            12 956,78
          </SummaryCell>
          <SummaryCell weight="medium" tone="default">
            14 159,99
          </SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="podsumowanie podwykonawców — tytuł + „Kwota”, ręczne komórki: bold / medium / bold, zaliczki tone=success"
        sources={['src/components/kosztorys/summary/blocks/subcontractor-headline-summary.tsx:31']}
      >
        <SummaryTable cols={TWO_COLS} className="w-fit">
          <SummaryHeaderCell>Podsumowanie podwykonawców</SummaryHeaderCell>
          <SummaryHeaderCell>Kwota</SummaryHeaderCell>
          <div className="contents">
            <SummaryCell>Z narzędziami</SummaryCell>
            <SummaryCell>8 000,00</SummaryCell>
            <SummaryCell>Bez narzędzi</SummaryCell>
            <SummaryCell>1 111,11</SummaryCell>
          </div>
          <SummaryCell weight="bold">Suma wykonanej pracy</SummaryCell>
          <SummaryCell weight="bold">9 111,11</SummaryCell>
          <div className="contents">
            <SummaryCell weight="medium">Premia</SummaryCell>
            <SummaryCell weight="medium">500,00</SummaryCell>
          </div>
          <SummaryCell weight="medium">Zaliczki (wypłaty)</SummaryCell>
          <SummaryCell tone="success" weight="medium">
            9 699,11
          </SummaryCell>
          <SummaryCell weight="bold">Pozostało do wypłaty</SummaryCell>
          <SummaryCell tone="error" weight="bold">
            −88,00
          </SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="materiały wg kategorii — zwykłe (wyszarzone) „Netto/Brutto/Różnica”, Różnica przez className text-muted-foreground"
        sources={['src/components/kosztorys/summary/tables/materials-breakdown-table.tsx:43']}
      >
        <SummaryTable cols={FOUR_COLS} className="w-fit">
          <SummaryHeaderCell>Materiały</SummaryHeaderCell>
          <SummaryHeaderCell>Netto</SummaryHeaderCell>
          <SummaryHeaderCell>Brutto</SummaryHeaderCell>
          <SummaryHeaderCell>Różnica</SummaryHeaderCell>
          <SummaryCell>Materiały budowlane</SummaryCell>
          <SummaryCell>1 000,00</SummaryCell>
          <SummaryCell>1 230,00</SummaryCell>
          <SummaryCell className="text-muted-foreground">−230,00</SummaryCell>
          <SummaryCell weight="bold">Razem</SummaryCell>
          <SummaryCell weight="bold">10 037,13</SummaryCell>
          <SummaryCell weight="bold">12 345,67</SummaryCell>
          <SummaryCell weight="bold" className="text-muted-foreground">
            −2 308,54
          </SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="wpłaty wg formy — zwykłe „Netto/Brutto”, brak wartości jako „×”, „Razem” bold z pustą komórką {''}"
        sources={['src/components/kosztorys/summary/tables/deposits-table.tsx:98']}
      >
        <SummaryTable cols={THREE_COLS} className="w-fit">
          <SummaryHeaderCell>Wpłaty wg formy</SummaryHeaderCell>
          <SummaryHeaderCell>Netto</SummaryHeaderCell>
          <SummaryHeaderCell>Brutto</SummaryHeaderCell>
          <SummaryCell>Wpłaty gotówką</SummaryCell>
          <SummaryCell>1 111,11</SummaryCell>
          <SummaryCell>×</SummaryCell>
          <SummaryCell>Wpłaty przelewem</SummaryCell>
          <SummaryCell>11 234,56</SummaryCell>
          <SummaryCell>13 818,51</SummaryCell>
          <SummaryCell weight="bold">Razem</SummaryCell>
          <SummaryCell weight="bold">12 345,67</SummaryCell>
          <SummaryCell>{''}</SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="podsumowanie pracowników — przycisk w komórce tytułu (flex justify-between), nazwy font-medium z notką, zaliczki tone=success, nadpłata z notką"
        sources={['src/components/kosztorys/summary/blocks/subcontractor-worker-totals.tsx:67']}
      >
        <SummaryTable cols={FOUR_COLS} className="h-fit w-fit">
          <SummaryHeaderCell className="flex items-center justify-between gap-2">
            <span>Podsumowanie pracowników</span>
            <Button type="button" variant="outline" size="sm">
              Rozlicz wypłaty
            </Button>
          </SummaryHeaderCell>
          <SummaryHeaderCell>Suma wykonanej pracy</SummaryHeaderCell>
          <SummaryHeaderCell>Zaliczki (wypłaty)</SummaryHeaderCell>
          <SummaryHeaderCell>Pozostało do wypłaty</SummaryHeaderCell>
          <div className="contents">
            <SummaryCell weight="medium">Jan Kowalski</SummaryCell>
            <SummaryCell>8 000,00</SummaryCell>
            <SummaryCell tone="success" weight="medium">
              6 888,89
            </SummaryCell>
            <SummaryCell tone="default" weight="medium">
              1 111,11
            </SummaryCell>
          </div>
          <div className="contents">
            <SummaryCell
              weight="medium"
              note={{ text: 'Wypłacono więcej niż wykonano', tone: 'error' }}
            >
              Adam Nowak
            </SummaryCell>
            <SummaryCell>1 111,11</SummaryCell>
            <SummaryCell tone="success" weight="medium">
              1 199,11
            </SummaryCell>
            <SummaryCell tone="error" weight="medium" note={{ text: 'nadpłacone', tone: 'error' }}>
              −88,00
            </SummaryCell>
          </div>
          <SummaryCell weight="bold">Razem</SummaryCell>
          <SummaryCell weight="bold">9 111,11</SummaryCell>
          <SummaryCell tone="success" weight="bold">
            8 088,00
          </SummaryCell>
          <SummaryCell tone="default" weight="bold">
            1 023,11
          </SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="podział etapów — macierz etap × pracownik, kolumna „Wartość etapu” wyciszona propem muted, udział jako notka %"
        sources={['src/components/kosztorys/summary/blocks/subcontractor-stage-breakdown.tsx:19']}
      >
        <SummaryTable cols={FOUR_COLS} className="h-fit w-fit">
          <SummaryHeaderCell>Podział etapów</SummaryHeaderCell>
          <SummaryHeaderCell>Wartość etapu</SummaryHeaderCell>
          <SummaryHeaderCell>Jan Kowalski</SummaryHeaderCell>
          <SummaryHeaderCell>Adam Nowak</SummaryHeaderCell>
          <div className="contents">
            <SummaryCell>Etap 1</SummaryCell>
            <SummaryCell muted>2 222,22</SummaryCell>
            <SummaryCell muted={false} note={{ text: '50%' }}>
              1 111,11
            </SummaryCell>
            <SummaryCell muted={false} note={{ text: '50%' }}>
              1 111,11
            </SummaryCell>
          </div>
          <div className="contents">
            <SummaryCell>Etap 2</SummaryCell>
            <SummaryCell muted>10 123,45</SummaryCell>
            <SummaryCell muted={false} note={{ text: '100%' }}>
              10 123,45
            </SummaryCell>
            <SummaryCell muted note={null}>
              —
            </SummaryCell>
          </div>
          <SummaryCell weight="bold">Razem</SummaryCell>
          <SummaryCell muted weight="bold">
            12 345,67
          </SummaryCell>
          <SummaryCell weight="bold">11 234,56</SummaryCell>
          <SummaryCell weight="bold">1 111,11</SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="koszty pojazdu — tytuł jako osobny h2 SUBSECTION_TITLE_CLASS mb-2 nad tabelą, nagłówek Rodzaj/Wpisy/Koszt"
        sources={['src/components/fleet/vehicle-costs.tsx:47']}
      >
        <div>
          <h2 className={`${SUBSECTION_TITLE_CLASS} mb-2`}>Podsumowanie</h2>
          <SummaryTable cols={THREE_COLS} className="w-fit">
            <SummaryHeaderCell>Rodzaj</SummaryHeaderCell>
            <SummaryHeaderCell>Wpisy</SummaryHeaderCell>
            <SummaryHeaderCell>Koszt</SummaryHeaderCell>
            <SummaryCell>Przegląd</SummaryCell>
            <SummaryCell>2</SummaryCell>
            <SummaryCell>1 111,11 zł</SummaryCell>
            <SummaryCell>Wymiana oleju</SummaryCell>
            <SummaryCell>3</SummaryCell>
            <SummaryCell>—</SummaryCell>
            <SummaryCell weight="bold">Razem</SummaryCell>
            <SummaryCell weight="bold">5</SummaryCell>
            <SummaryCell weight="bold">1 111,11 zł</SummaryCell>
          </SummaryTable>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="m"
        label="rozliczenie w protokole odbioru — h3 w sekcji gap-2, tabela bez wiersza nagłówka, „Suma” medium, wynik bold i czerwony gdy > 0"
        sources={['src/components/kosztorys/editor/dialogs/acceptance-protocol-dialog.tsx:188']}
      >
        <section className="flex flex-col gap-2">
          <h3 className={SUBSECTION_TITLE_CLASS}>Rozliczenie (netto)</h3>
          <SummaryTable cols={TWO_COLS} className="w-fit">
            <SummaryCell>Robocizna</SummaryCell>
            <SummaryCell>12 345,67 zł</SummaryCell>
            <SummaryCell>Rabat</SummaryCell>
            <SummaryCell>−500,00 zł</SummaryCell>
            <SummaryCell>Materiały</SummaryCell>
            <SummaryCell>1 111,11 zł</SummaryCell>
            <SummaryCell weight="medium">Suma</SummaryCell>
            <SummaryCell weight="medium">12 956,78 zł</SummaryCell>
            <SummaryCell>Wpłaty</SummaryCell>
            <SummaryCell>−11 234,56 zł</SummaryCell>
            <SummaryCell weight="bold">Pozostało do zapłaty</SummaryCell>
            <SummaryCell weight="bold" tone="error">
              1 722,22 zł
            </SummaryCell>
          </SummaryTable>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="n"
        label="moje kasy (strona pracownika) — tytuł CollapsibleSection, SummaryTable text-sm z kolumną SUMMARY_NAME_COL, kolor wg znaku też w „Razem” (bez storageKey)"
        sources={['src/components/users/owned-registers-section.tsx:42']}
      >
        <div className="w-full">
          <CollapsibleSection title="Moje kasy" withSeparator={false}>
            <SummaryTable cols={NAME_COLS} className="w-fit text-sm">
              <SummaryHeaderCell>Kasa</SummaryHeaderCell>
              <SummaryHeaderCell>Saldo</SummaryHeaderCell>
              <SummaryCell note={null}>Kasa Jana</SummaryCell>
              <SummaryCell tone="default">1 111,11 zł</SummaryCell>
              <SummaryCell note={{ text: 'nieaktywna' }}>Kasa budowa</SummaryCell>
              <SummaryCell tone="error">−88,00 zł</SummaryCell>
              <SummaryCell weight="bold">Razem</SummaryCell>
              <SummaryCell weight="bold" tone="default">
                1 023,11 zł
              </SummaryCell>
            </SummaryTable>
          </CollapsibleSection>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="o"
        label="salda kas wg typu — kafelki ToggleStatButtons (border-2 w kolorze typu) + linia „Saldo: …” z licznikiem wybranych + tekst pomocy"
        sources={['src/components/cash-registers/register-balance-chart.tsx:30']}
      >
        <div className="w-full">
          <ToggleStatButtons
            rows={[REGISTER_TYPE_ENTRIES]}
            summaryLabel="Saldo"
            helpText="Saldo liczone jest dynamicznie jako suma wybranych typów kas oraz filtrów."
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="p"
        label="pulpit — ToggleStatButtons z etykietą wiersza i kolorowymi kwotami (colorValues) + druga, osobna linia SignedMoneyDisplay"
        sources={['src/components/dashboard/user-register-stats.tsx:31']}
      >
        <div className="w-full space-y-4">
          <ToggleStatButtons
            rows={[OWN_REGISTER_ENTRIES]}
            summaryLabel="Saldo moich kas"
            rowLabels={['Moje Kasy']}
            colorValues
          />
          <SignedMoneyDisplay amount={12345.67} label="Saldo wszystkich kas (bez wirtualnych)" />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="q"
        label="finanse inwestycji (v1) — trzy wiersze kafelków + „Bilans inwestora”, pod spodem kafelki „wliczone w robociznę”, kafelek „Wypłaty” i linia „Marża”"
        sources={['src/components/investments/financial-stats.tsx:106']}
      >
        <div className="w-full space-y-2">
          <ToggleStatButtons
            rows={INVESTOR_ROWS}
            rowLabels={['Koszty inwestora']}
            rowTooltips={['Materiały kupione na inwestycję, w podziale na kategorie.']}
            summaryLabel="Bilans inwestora"
            summaryTooltip="Bilans inwestora = Wpłaty − Materiały − Robocizna + Rabat + obniżka materiałów + Strata."
          />
          <div className="text-muted-foreground space-y-1 text-sm">
            <Description>
              Materiały wliczone w robociznę
              <InfoTooltip
                content="Materiały kupione przez firmę, wliczone w robociznę."
                label="Co to jest: Materiały wliczone w robociznę"
                className="ml-1"
              />
            </Description>
            <StatButton label="Materiały budowlane" value="1 111,11 zł" color="transfer-fuchsia" />
          </div>
          <div className="text-muted-foreground space-y-1 text-sm">
            <StatButton
              label="Wypłaty"
              value="8 000,00 zł"
              className="border-chart-red"
              tooltip="Kwoty wypłacone pracownikom. Obniżają marżę."
            />
            <SignedMoneyDisplay
              amount={3234.56}
              label="Marża"
              tooltip="Marża = Robocizna − Wypłaty − Rabat − Strata."
            />
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="r"
        label="saldo w formularzu wydatku / transferu — Panel tone=muted px-6 py-4, SignedMoneyDisplay / „etykieta: kwota” font-medium / SignedMoneyDisplay"
        sources={['src/components/forms/form-components/register-balance-summary.tsx:17']}
      >
        <Panel tone="muted" className="mt-6 space-y-1 px-6 py-4">
          <SignedMoneyDisplay amount={12345.67} label="Aktualne saldo" />
          <p className="text-sm">
            Suma wydatków: <span className="font-medium">1 111,11 zł</span>
          </p>
          <SignedMoneyDisplay amount={11234.56} label="Saldo po transakcji" />
        </Panel>
      </AuditVariant>
    </AuditGroup>
  )
}
