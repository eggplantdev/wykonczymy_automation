import { Panel } from '@/components/ui/panel'
import { SignedMoneyDisplay } from '@/components/ui/signed-money-display'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const TWO_COLS = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`
const THREE_COLS = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`
const FOUR_COLS = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`

const TABLE = 'w-auto min-w-64 max-sm:text-xs'
const CELL = 'py-1.5 pl-7 first:pl-0'
const LABEL = cn(CELL, 'text-muted-foreground text-left')
const VALUE = cn(CELL, 'text-right font-medium whitespace-nowrap tabular-nums')
const HEAD = 'border-border text-muted-foreground border-b text-xs [&>td]:font-normal'
const GRAND =
  'border-foreground border-t text-base max-sm:text-sm [&>td]:pt-2.5 [&>td]:font-semibold'

const TABLE_FOOTER_CLASS =
  '[&_td]:border-border [&_td]:bg-background [&_td]:text-foreground [&_td]:sticky [&_td]:bottom-0 [&_td]:border-t [&_td]:px-3 [&_td]:py-2'

export function A11TotalRowGroup() {
  return (
    <AuditGroup
      id="A11"
      title="Wiersz sumy"
      count="27 wystąpień w 22 plikach · 16 wersji"
      drift={[
        'Waga: font-bold (SummaryTable, ColumnTotalRow, etykieta stopki siatki) vs font-semibold (wartości siatki, GRAND) vs font-medium („Łącznie”, „Suma: …”) vs zwykła (surowa tabela raportu).',
        'Budowa: helper SummaryRow bold vs ręcznie wpisane SummaryCell + N × SummaryCell weight="bold" vs surowe <tr>/<td> z lokalnymi stałymi TABLE/CELL/LABEL/VALUE.',
        'Wyciszenie: prop muted (opacity) vs className="text-muted-foreground" vs cn(VALUE, \'text-muted-foreground\').',
        'Kolor: tone="success" / tone="error" wg znaku / notka „nadpłacone” — każdy wiersz liczy to po swojemu; w surowej tabeli text-chart-green i text-destructive wpisane ręcznie.',
        "Wypełniacze: pusta komórka {''} albo <td /> vs colSpan; etykieta „Razem” / t('summaryTotal') / t('total') / „Łącznie”.",
        'Linia „Suma: …”: cały akapit font-medium leading-none vs tylko kwota font-medium (obok SignedMoneyDisplay z font-semibold).',
        'Po fazie 1: b, g i h zostają ręczne — SummaryRow formatuje formatNet (bez „zł”) i wymaga MoneyPairT z osią, a kasy i protokół odbioru mają formatPLN, koszty pojazdu liczbę, wpłaty pustą komórkę brutto.',
      ]}
      proposal={
        <>
          <code>SummaryTotalRow</code> w <code>summary-grid</code> (props:{' '}
          <code>label = 'Razem'</code>, <code>values</code> z <code>tone</code>/<code>muted</code>/
          <code>note</code> per komórka) jako jedyny wiersz sumy w SummaryTable, plus{' '}
          <code>TotalLine</code> (<code>label</code>, <code>amount</code>, <code>count?</code>) dla
          linii „Suma: …”; raport pracownika przechodzi na SummaryTable.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="ColumnTotalRow w stopce DataTable (font-bold, colSpan na etykietę)"
        sources={[
          'src/components/forms/settle-payouts-form/settle-payouts-table.tsx:227',
          'src/components/forms/settle-payouts-form/settle-payouts-table.tsx:235',
          'src/components/fleet/fleet-data-table.tsx:29',
          'src/components/equipment/equipment-history.tsx:65',
          'src/components/kosztorys/summary/tables/materials-transactions-table.tsx:227',
        ]}
      >
        <table className="w-full text-sm">
          <tfoot className={TABLE_FOOTER_CLASS}>
            <tr>
              <td className="font-bold" colSpan={2}>
                Razem
              </td>
              <td className="text-right font-bold tabular-nums">12 345,67 zł</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="ręczny wiersz bold z kolorem wg znaku (tone=error)"
        sources={[
          'src/components/users/owned-registers-section.tsx:65',
          'src/components/kosztorys/editor/dialogs/acceptance-protocol-dialog.tsx:195',
          'src/components/kosztorys/summary/blocks/subcontractor-headline-summary.tsx:69',
        ]}
      >
        <SummaryTable cols={TWO_COLS} className="w-fit text-sm">
          <SummaryCell>Kasa Jana</SummaryCell>
          <SummaryCell>1 111,11 zł</SummaryCell>
          <SummaryCell weight="bold">Razem</SummaryCell>
          <SummaryCell weight="bold" tone="error">
            −88,00 zł
          </SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="helper SummaryRow bold (danger → tone=error)"
        sources={[
          'src/components/kosztorys/summary/tabs/summary-stages-tab.tsx:58',
          'src/components/kosztorys/summary/tables/margin-actual-table.tsx:80',
          'src/components/kosztorys/summary/tables/margin-forecast-table.tsx:44',
        ]}
      >
        <SummaryTable cols={THREE_COLS} className="w-fit">
          <SummaryCell weight="default">Etap 1</SummaryCell>
          <SummaryCell weight="default" tone="default">
            1 111,11 zł
          </SummaryCell>
          <SummaryCell weight="default" tone="default">
            1 366,67 zł
          </SummaryCell>
          <SummaryCell weight="bold">Razem</SummaryCell>
          <SummaryCell weight="bold" tone="default">
            12 345,67 zł
          </SummaryCell>
          <SummaryCell weight="bold" tone="default">
            15 185,17 zł
          </SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="akapit „Suma: …” — cały font-medium leading-none (wariant z licznikiem zaznaczonych)"
        sources={[
          'src/components/forms/expense-form/line-items-field.tsx:453',
          'src/components/forms/expense-form/paragon-footer.tsx:47',
        ]}
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm leading-none font-medium">Suma: 12 345,67 zł</p>
          <p className="text-sm leading-none font-medium">Suma zaznaczonych (3): 1 111,11 zł</p>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="stopka sekcji w siatce kosztorysu — etykieta font-bold, kwota font-semibold"
        sources={[
          'src/components/kosztorys/editor/grid/cells/section-footer-cell.tsx:33',
          'src/components/kosztorys/editor/grid/cells/section-footer-cell.tsx:43',
        ]}
      >
        <div className="border-border flex h-9 w-full border">
          <div className="border-border w-48 border-r">
            <div className="text-foreground grid-cell-text flex size-full items-center gap-1 overflow-hidden px-2 font-bold whitespace-nowrap">
              <span>Razem</span>
              <span>Łazienka</span>
            </div>
          </div>
          <div className="w-32">
            <div className="grid-cell-text flex size-full items-center px-2 font-semibold tabular-nums">
              12 345,67
            </div>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="surowe <tr> bez pogrubienia, wyciszona komórka + pusta <td /> (raport pracownika)"
        sources={[
          'src/components/kosztorys/worker-report/worker-summary.tsx:53',
          'src/components/kosztorys/worker-report/worker-summary.tsx:114',
        ]}
      >
        <table className={TABLE}>
          <tbody>
            <tr>
              <td className={LABEL}>Etap 1</td>
              <td className={cn(VALUE, 'text-muted-foreground')}>2 222,22 zł</td>
              <td className={cn(VALUE, 'text-muted-foreground')}>50%</td>
              <td className={VALUE}>1 111,11 zł</td>
            </tr>
            <tr>
              <td className={LABEL}>Razem</td>
              <td className={cn(VALUE, 'text-muted-foreground')}>24 691,34 zł</td>
              <td className={VALUE} />
              <td className={VALUE}>12 345,67 zł</td>
            </tr>
          </tbody>
        </table>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="ręczny wiersz bold — sama etykieta i wartości"
        sources={['src/components/fleet/vehicle-costs.tsx:62']}
      >
        <SummaryTable cols={THREE_COLS} className="w-fit">
          <SummaryCell>Przegląd</SummaryCell>
          <SummaryCell>2</SummaryCell>
          <SummaryCell>1 111,11 zł</SummaryCell>
          <SummaryCell weight="bold">Razem</SummaryCell>
          <SummaryCell weight="bold">5</SummaryCell>
          <SummaryCell weight="bold">12 345,67 zł</SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="ręczny wiersz bold + pusta komórka-wypełniacz {''}"
        sources={['src/components/kosztorys/summary/tables/deposits-table.tsx:111']}
      >
        <SummaryTable cols={THREE_COLS} className="w-fit">
          <SummaryCell>Przelew</SummaryCell>
          <SummaryCell>1 111,11 zł</SummaryCell>
          <SummaryCell>1 366,67 zł</SummaryCell>
          <SummaryCell weight="bold">Razem</SummaryCell>
          <SummaryCell weight="bold">12 345,67 zł</SummaryCell>
          <SummaryCell>{''}</SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="ręczny wiersz bold + wyciszenie przez className text-muted-foreground"
        sources={['src/components/kosztorys/summary/tables/materials-breakdown-table.tsx:60']}
      >
        <SummaryTable cols={FOUR_COLS} className="w-fit">
          <SummaryCell>Materiały budowlane</SummaryCell>
          <SummaryCell>1 000,00 zł</SummaryCell>
          <SummaryCell>1 230,00 zł</SummaryCell>
          <SummaryCell className="text-muted-foreground">−230,00 zł</SummaryCell>
          <SummaryCell weight="bold">Razem</SummaryCell>
          <SummaryCell weight="bold">10 037,13 zł</SummaryCell>
          <SummaryCell weight="bold">12 345,67 zł</SummaryCell>
          <SummaryCell weight="bold" className="text-muted-foreground">
            −2 308,54 zł
          </SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="ręczny wiersz bold + wyciszenie przez prop muted (opacity)"
        sources={['src/components/kosztorys/summary/blocks/subcontractor-stage-breakdown.tsx:47']}
      >
        <SummaryTable cols={THREE_COLS} className="w-fit">
          <SummaryCell>Etap 1</SummaryCell>
          <SummaryCell muted>2 222,22 zł</SummaryCell>
          <SummaryCell>1 111,11 zł</SummaryCell>
          <SummaryCell weight="bold">Razem</SummaryCell>
          <SummaryCell muted weight="bold">
            24 691,34 zł
          </SummaryCell>
          <SummaryCell weight="bold">12 345,67 zł</SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="ręczny wiersz bold + tone=success i komórka „Pozostało” z notką nadpłaty"
        sources={['src/components/kosztorys/summary/blocks/subcontractor-worker-totals.tsx:109']}
      >
        <SummaryTable cols={FOUR_COLS} className="h-fit w-fit">
          <SummaryCell weight="bold">Razem</SummaryCell>
          <SummaryCell weight="bold">12 345,67 zł</SummaryCell>
          <SummaryCell tone="success" weight="bold">
            12 433,67 zł
          </SummaryCell>
          <SummaryCell tone="error" weight="bold" note={{ text: 'nadpłacone', tone: 'error' }}>
            −88,00 zł
          </SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="helper SummaryRow emphasize — „Łącznie” tylko font-medium"
        sources={['src/components/kosztorys/summary/tables/summary-breakdown-table.tsx:51']}
      >
        <SummaryTable cols={THREE_COLS}>
          <SummaryCell weight="default">Materiały</SummaryCell>
          <SummaryCell weight="default" tone="default">
            1 111,11 zł
          </SummaryCell>
          <SummaryCell weight="default" tone="default">
            1 366,67 zł
          </SummaryCell>
          <SummaryCell weight="medium">Łącznie</SummaryCell>
          <SummaryCell weight="medium" tone="default">
            12 345,67 zł
          </SummaryCell>
          <SummaryCell weight="medium" tone="default">
            15 185,17 zł
          </SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="m"
        label="ręczny wiersz bold z notką błędu zamiast kwoty (marża wstrzymana)"
        sources={['src/components/kosztorys/summary/tables/margin-actual-table.tsx:74']}
      >
        <SummaryTable cols={TWO_COLS} className="w-fit">
          <SummaryCell weight="bold">Marża</SummaryCell>
          <SummaryCell
            weight="bold"
            note={{ text: 'Etapy z wykonaną pracą, ale bez rozliczenia.', tone: 'error' }}
          >
            Ustaw rozliczenie etapów
          </SummaryCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="n"
        label="surowa tabela z lokalnymi TABLE/CELL/HEAD/GRAND — wiersz GRAND (border-t, font-semibold, text-base)"
        sources={['src/components/kosztorys/worker-report/worker-summary.tsx:88']}
      >
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
              <td className={LABEL}>Wypłacone</td>
              <td className={cn(VALUE, 'text-chart-green')}>12 433,67 zł</td>
            </tr>
            <tr className={GRAND}>
              <td className={cn(CELL, 'text-left')}>Nadpłata</td>
              <td className={cn(VALUE, 'text-destructive')}>88,00 zł</td>
            </tr>
          </tbody>
        </table>
      </AuditVariant>

      <AuditVariant
        letter="o"
        label="„etykieta: kwota” — tylko kwota font-medium, między dwoma SignedMoneyDisplay"
        sources={['src/components/forms/form-components/register-balance-summary.tsx:19']}
      >
        <Panel tone="muted" className="w-full space-y-1 px-6 py-4">
          <SignedMoneyDisplay amount={12345.67} label="Aktualne saldo" />
          <p className="text-sm">
            Suma wydatków: <span className="font-medium">1 111,11 zł</span>
          </p>
          <SignedMoneyDisplay amount={11234.56} label="Saldo po transakcji" />
        </Panel>
      </AuditVariant>

      <AuditVariant
        letter="p"
        label="wiersz sum siatki kosztorysu — pasek bg-muted border-t-2, text-base font-semibold"
        sources={['src/components/kosztorys/editor/grid/kosztorys-synthetic-rows.tsx:36']}
      >
        <div className="flex h-9 w-full">
          <div className="w-48">
            <div className="kosztorys-totals-cell bg-muted text-foreground border-border flex size-full items-center border-t-2 px-2 text-base font-semibold tabular-nums max-sm:text-sm">
              Razem
            </div>
          </div>
          <div className="w-32">
            <div className="kosztorys-totals-cell bg-muted text-foreground border-border flex size-full items-center border-t-2 px-2 text-base font-semibold tabular-nums max-sm:text-sm">
              12 345,67
            </div>
          </div>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
