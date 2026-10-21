/* eslint-disable local/no-hand-rolled-ui -- audit page renders verbatim copies of hand-rolled markup */
import { BalanceCell } from '@/components/ui/balance-cell'
import { Button } from '@/components/ui/button'
import { LabelHintIcon } from '@/components/ui/label-hint-icon'
import { OptionalLink } from '@/components/ui/optional-link'
import { SignedMoneyDisplay } from '@/components/ui/signed-money-display'
import { SUMMARY_LABEL_COL, SummaryLabelCell, SummaryTable } from '@/components/ui/summary-grid'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const MONEY_SAMPLES = ['1 111,11 zł', '88,00 zł', '12 345,67 zł']
const MONEY_VALUES = [1111.11, -88, 12345.67]
const DATE_SAMPLES = ['20.10.2026', '1.10.2026', '12.09.2026']
const DATETIME_SAMPLES = ['20.10.2026, 14:05', '1.10.2026, 9:40', '12.09.2026, 18:22']
const QTY_SAMPLES = ['12,5 m²', '3 szt.', '120 m²']

const LABEL = 'py-1.5 pl-7 first:pl-0 text-muted-foreground text-left'

export function A02MoneyNumberGroup() {
  return (
    <AuditGroup
      id="A02"
      title="Kwota, liczba i data w komórce"
      count="76 wystąpień w 36 plikach · 33 wersje"
      drift={[
        'tabular-nums: jest w części kolumn kwot i dat, w innych (Robocizna v1, Telmak, duplikaty, wszystkie BalanceCell) cyfry nie trzymają kolumny.',
        'Wyrównanie: meta.align right vs brak (Cena j.m. w katalogu, kwota odrzuconego paragonu) vs center (raporty pracowników).',
        'Waga: BalanceCell font-medium, w rozliczeniu nadpisany na font-normal; „Wydatki inwestycyjne” font-medium ręcznie; reszta zwykła.',
        'Zawijanie: whitespace-nowrap tylko w rozliczeniu, raportach i stawkach arkusza — reszta kwot może się złamać po spacji tysięcy.',
        'Pusta wartość: formatPLNOrDash vs ręczny ternary z „—” (== null albo truthy) vs formatPLN, który pokazuje 0,00 zł.',
        'Kolor kwoty liczony lokalnie: text-chart-green, text-destructive, FLAGGED_TONE, text-warning, line-through przy anulowaniu.',
      ]}
      proposal={
        <>
          Prymityw <code>Money</code> w <code>ui/</code> (props: <code>value</code>,{' '}
          <code>{"format: 'pln' | 'net' | 'plnOrDash'"}</code>, <code>weight</code>,{' '}
          <code>tone</code>, <code>cancelled</code>) zawsze z tabular-nums i whitespace-nowrap, plus{' '}
          <code>moneyColumn</code>/<code>dateColumn</code> w DataTable, które same ustawiają{' '}
          <code>align: right</code> i tabular-nums.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="goły tekst bez wyrównania — daty, daty z godziną i kwota odrzuconego paragonu"
        sources={[
          'src/components/receipt-confirmation/rejected-receipts.tsx:40',
          'src/components/receipt-confirmation/rejected-receipts.tsx:58',
          'src/components/tables/investments.tsx:108',
          'src/components/tables/transfers.tsx:67',
          'src/components/tables/presets.tsx:23',
          'src/components/tables/expense-duplicates.tsx:87',
          'src/components/tables/expense-drafts.tsx:138',
          'src/components/tables/worker-reports.tsx:57',
          'src/components/tables/telmak-check.tsx:54',
          'src/components/tables/leads.tsx:94',
          'src/components/tables/presets.tsx:22',
        ]}
      >
        <div className="flex flex-col items-start">
          {DATE_SAMPLES.map((sample) => (
            <div key={sample}>{sample}</div>
          ))}
        </div>
        <div className="flex flex-col items-start">
          {DATETIME_SAMPLES.map((sample) => (
            <div key={sample}>{sample}</div>
          ))}
        </div>
        <div className="flex flex-col items-start">
          {MONEY_SAMPLES.map((sample) => (
            <div key={sample}>{sample}</div>
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="goły tekst z formatPLN/formatPLNOrDash w kolumnie do prawej (bez tabular-nums)"
        sources={[
          'src/components/tables/investments.tsx:209',
          'src/components/tables/investments.tsx:248',
          'src/components/tables/investments.tsx:256',
          'src/components/tables/telmak-check.tsx:58',
          'src/components/tables/telmak-check.tsx:63',
          'src/components/tables/expense-duplicates.tsx:93',
          'src/components/forms/settle-payouts-form/settle-payouts-table.tsx:169',
          'src/components/forms/settle-payouts-form/settle-payouts-table.tsx:175',
          'src/components/forms/settle-payouts-form/settle-payouts-table.tsx:180',
        ]}
      >
        <div className="flex flex-col items-end">
          {MONEY_SAMPLES.map((sample) => (
            <div key={sample}>{sample}</div>
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="span tabular-nums w kolumnie wyrównanej do prawej"
        sources={[
          'src/components/tables/fleet.tsx:63',
          'src/components/equipment/equipment-history.tsx:47',
          'src/components/kosztorys/summary/tables/materials-transactions-table.tsx:137',
          'src/components/tables/presets.tsx:15',
          'src/components/tables/presets.tsx:20',
          'src/components/tables/worker-reports.tsx:68',
          'src/components/tables/work-catalogue.tsx:238',
          'src/components/kosztorys/editor/dialogs/stage-split/stage-split-dialog.tsx:112',
        ]}
      >
        <div className="flex flex-col items-end">
          {MONEY_SAMPLES.map((sample) => (
            <span key={sample} className="tabular-nums">
              {sample}
            </span>
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="SignedMoneyDisplay — saldo z etykietą (domyślnie „Saldo”)"
        sources={[
          'src/app/(frontend)/kasa/[id]/page.tsx:68',
          'src/components/forms/form-components/register-balance-summary.tsx:18',
          'src/components/forms/form-components/register-balance-summary.tsx:22',
          'src/components/forms/settle-payouts-form/settle-payouts-form.tsx:206',
          'src/components/forms/form-fields/source-register-field.tsx:45',
          'src/components/dashboard/user-register-stats.tsx:41',
        ]}
      >
        <div className="flex flex-col gap-1">
          <SignedMoneyDisplay amount={12345.67} />
          <SignedMoneyDisplay amount={-88} label="Saldo po wypłacie" />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="span tabular-nums bez wyrównania (daty, Cena j.m. i stawka w katalogu)"
        sources={[
          'src/components/tables/work-catalogue.tsx:40',
          'src/components/tables/work-catalogue.tsx:160',
          'src/components/equipment/equipment-history.tsx:20',
          'src/components/kosztorys/summary/tables/materials-transactions-table.tsx:61',
          'src/components/kosztorys/summary/tables/subcontractor-payouts-table.tsx:30',
        ]}
      >
        <div className="flex flex-col items-start">
          {DATE_SAMPLES.map((sample) => (
            <span key={sample} className="tabular-nums">
              {sample}
            </span>
          ))}
        </div>
        <div className="flex flex-col items-start">
          {MONEY_SAMPLES.map((sample) => (
            <span key={sample} className="tabular-nums">
              {sample}
            </span>
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="BalanceCell (font-medium, czerwień dla ujemnych, bez tabular-nums)"
        sources={[
          'src/components/tables/cash-registers.tsx:38',
          'src/components/tables/investments.tsx:65',
          'src/components/tables/investments.tsx:149',
          'src/components/tables/investments.tsx:159',
          'src/components/tables/investments.tsx:192',
        ]}
      >
        <div className="flex flex-col items-end">
          {MONEY_VALUES.map((value) => (
            <BalanceCell key={value} value={value} />
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="span whitespace-nowrap tabular-nums wyrównany do prawej (ilość z jednostką)"
        sources={[
          'src/components/worker-reports/report-preview-table.tsx:64',
          'src/components/worker-reports/report-preview-table.tsx:77',
          'src/components/kosztorys/worker-report/draft-extra-works.tsx:17',
        ]}
      >
        <div className="flex flex-col items-end">
          {QTY_SAMPLES.map((sample) => (
            <span key={sample} className="whitespace-nowrap tabular-nums">
              {sample}
            </span>
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="BalanceCell settled (0 zł na zielono)"
        sources={[
          'src/components/tables/investments.tsx:277',
          'src/components/tables/users.tsx:63',
        ]}
      >
        <div className="flex flex-col items-end">
          <BalanceCell value={0} settled />
          <BalanceCell value={1111.11} settled />
          <BalanceCell value={-88} settled />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="span whitespace-nowrap tabular-nums wyśrodkowany (numer formularza, ilość)"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:416',
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:446',
        ]}
      >
        <div className="flex flex-col items-center">
          <span className="whitespace-nowrap tabular-nums">1042-7</span>
          {QTY_SAMPLES.map((sample) => (
            <span key={sample} className="whitespace-nowrap tabular-nums">
              {sample}
            </span>
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="surowe <td> py-1 pl-3 text-right tabular-nums (porównanie z katalogiem)"
        sources={[
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-diff-table.tsx:227',
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-diff-table.tsx:230',
        ]}
      >
        <table>
          <tbody>
            {MONEY_SAMPLES.map((sample) => (
              <tr key={sample}>
                <td className="py-1 pl-3 text-right tabular-nums">{sample}</td>
                <td className="py-1 pl-3 text-right tabular-nums">auto</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="BalanceCell className font-normal whitespace-nowrap"
        sources={['src/components/forms/settle-payouts-form/settle-payouts-table.tsx:186']}
      >
        <div className="flex flex-col items-end">
          {MONEY_VALUES.map((value) => (
            <BalanceCell key={value} value={value} className="font-normal whitespace-nowrap" />
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="BalanceCell settled + font-normal whitespace-nowrap (Pozostało w rozliczeniu)"
        sources={['src/components/forms/settle-payouts-form/settle-payouts-table.tsx:149']}
      >
        <div className="flex flex-col items-end">
          <BalanceCell value={0} settled className="font-normal whitespace-nowrap" />
          <BalanceCell value={1111.11} settled className="font-normal whitespace-nowrap" />
          <BalanceCell value={-88} settled className="font-normal whitespace-nowrap" />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="m"
        label="SignedMoneyDisplay z tooltipem"
        sources={['src/components/investments/financial-stats.tsx:139']}
      >
        <SignedMoneyDisplay
          amount={12345.67}
          label="Marża"
          tooltip="Marża = robocizna z kosztorysu − koszt ekipy − rabat."
        />
      </AuditVariant>

      <AuditVariant
        letter="n"
        label="span font-medium bez tabular-nums („Wydatki inwestycyjne”)"
        sources={['src/components/tables/investments.tsx:242']}
      >
        <div className="flex flex-col items-end">
          {MONEY_SAMPLES.map((sample) => (
            <span key={sample} className="font-medium">
              {sample}
            </span>
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="o"
        label="HintedValue (inline-flex justify-end gap-1) z gołą kwotą i ikoną rozjazdu"
        sources={['src/components/tables/investments.tsx:232']}
      >
        <div className="flex flex-col items-end">
          <span className="inline-flex items-center justify-end gap-1">
            1 111,11 zł
            <LabelHintIcon variant="mismatch" content="Rozjazd z „Robocizna v1”: 88,00 zł." />
          </span>
          <span className="inline-flex items-center justify-end gap-1">88,00 zł</span>
          <span className="inline-flex items-center justify-end gap-1">12 345,67 zł</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="p"
        label="HintedValue z BalanceCell i ikoną zaliczek spoza płaszczyzny"
        sources={['src/components/tables/investments.tsx:181']}
      >
        <div className="flex flex-col items-end">
          <span className="inline-flex items-center justify-end gap-1">
            <BalanceCell value={1111.11} />
            <LabelHintIcon
              variant="strandedDeposits"
              content="Zaliczka 88,00 zł wpłynęła na płaszczyźnie netto."
            />
          </span>
          <span className="inline-flex items-center justify-end gap-1">
            <BalanceCell value={-88} />
          </span>
          <span className="inline-flex items-center justify-end gap-1">
            <BalanceCell value={12345.67} />
          </span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="q"
        label="span text-chart-green tabular-nums (wypłaty podwykonawcy)"
        sources={['src/components/kosztorys/summary/tables/subcontractor-payouts-table.tsx:49']}
      >
        <div className="flex flex-col items-end">
          {MONEY_SAMPLES.map((sample) => (
            <span key={sample} className="text-chart-green tabular-nums">
              {sample}
            </span>
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="r"
        label="tabular-nums + anulowana: text-muted-foreground line-through, w OptionalLink"
        sources={['src/components/tables/expense-drafts.tsx:49']}
      >
        <div className="flex flex-col items-end">
          <OptionalLink href="#">
            <span className="tabular-nums">1 111,11 zł</span>
          </OptionalLink>
          <OptionalLink href="#">
            <span className="text-muted-foreground tabular-nums line-through">88,00 zł</span>
          </OptionalLink>
          <OptionalLink href="#">
            <span className="tabular-nums">12 345,67 zł</span>
          </OptionalLink>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="s"
        label="liczba porządkowa: text-muted-foreground tabular-nums"
        sources={['src/components/tables/work-catalogue.tsx:77']}
      >
        <div className="flex flex-col items-end">
          <span className="text-muted-foreground tabular-nums">1</span>
          <span className="text-muted-foreground tabular-nums">48</span>
          <span className="text-muted-foreground tabular-nums">112</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="t"
        label="procent tabular-nums + FLAGGED_TONE (text-destructive font-medium) ponad próg"
        sources={['src/components/tables/work-catalogue.tsx:56']}
      >
        <div className="flex flex-col items-start">
          <span className="tabular-nums">12%</span>
          <span className="text-destructive font-medium tabular-nums">135%</span>
          <span className="tabular-nums">8,5%</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="u"
        label="span whitespace-nowrap tabular-nums bez wyrównania (numer formularza)"
        sources={['src/components/worker-reports/report-preview-table.tsx:28']}
      >
        <div className="flex flex-col items-start">
          <span className="whitespace-nowrap tabular-nums">1042-7</span>
          <span className="whitespace-nowrap tabular-nums">88-3</span>
          <span className="whitespace-nowrap tabular-nums">12345-6</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="v"
        label="kwota netto w nagłówku sekcji siatki: font-medium tabular-nums + wyszarzone „netto”"
        sources={['src/components/kosztorys/editor/grid/cells/section-header-cell.tsx:137']}
      >
        <span className="grid-cell-text shrink-0 whitespace-nowrap">
          <span className="font-medium tabular-nums">12 345,67 zł</span>
          <span className="text-muted-foreground font-normal"> netto</span>
        </span>
      </AuditVariant>

      <AuditVariant
        letter="w"
        label="stawka z arkusza: whitespace-nowrap + ton (zielony/czerwony) i notka block text-xs"
        sources={['src/components/kosztorys/editor/dialogs/sheet/sheet-rates-block.tsx:256']}
      >
        <div className="text-right">
          <span className={cn('whitespace-nowrap', 'text-chart-green')}>1 111,11 zł</span>
          <span className={cn('block text-xs whitespace-nowrap', 'text-chart-green')}>
            przyjęta z arkusza
          </span>
        </div>
        <div className="text-right">
          <span className={cn('whitespace-nowrap', 'text-destructive')}>88,00 zł</span>
          <span className={cn('block text-xs whitespace-nowrap', 'text-destructive')}>
            inna niż w kosztorysie
          </span>
        </div>
        <div className="text-right">
          <span className="whitespace-nowrap">12 345,67 zł</span>
          <span className={cn('block text-xs whitespace-nowrap', 'text-muted-foreground')}>
            brak w kosztorysie
          </span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="x"
        label="para stawek: text-warning przy różnicy, pod spodem „… w kosztorysie” (bez nowrap)"
        sources={['src/components/kosztorys/editor/dialogs/sheet/sheet-rates-block.tsx:267']}
      >
        <div className="text-right">
          <span className="text-warning">1 111,11 zł</span>
          <span className="text-muted-foreground block text-xs">88,00 zł w kosztorysie</span>
        </div>
        <div className="text-right">
          <span>12 345,67 zł</span>
          <span className="text-muted-foreground block text-xs">12 345,67 zł w kosztorysie</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="y"
        label="kwota o stałej szerokości w wierszu: w-20 shrink-0 text-right tabular-nums obok jednostki w-16"
        sources={[
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-candidate-row.tsx:30',
        ]}
      >
        <div className="flex flex-col">
          {MONEY_SAMPLES.map((sample) => (
            <div key={sample} className="flex items-center gap-2">
              <span className="text-muted-foreground w-16 shrink-0 text-right">m²</span>
              <span className="w-20 shrink-0 text-right tabular-nums">{sample}</span>
            </div>
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="z"
        label="span text-right tabular-nums jako komórka siatki (udziały w podziale etapu)"
        sources={['src/components/kosztorys/editor/dialogs/stage-split/stage-split-dialog.tsx:133']}
      >
        <div className="grid w-40 grid-cols-1">
          {MONEY_SAMPLES.map((sample) => (
            <span key={sample} className="text-right tabular-nums">
              {sample}
            </span>
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="aa"
        label="surowe <td> różnicy: tabular-nums + text-warning albo text-muted-foreground (klasa w template stringu)"
        sources={['src/components/kosztorys/editor/dialogs/catalogue/catalogue-diff-table.tsx:234']}
      >
        <table>
          <tbody>
            <tr>
              <td className="text-warning py-1 pl-3 text-right tabular-nums">1 111,11 zł</td>
            </tr>
            <tr>
              <td className="text-muted-foreground py-1 pl-3 text-right tabular-nums">88,00 zł</td>
            </tr>
            <tr>
              <td className="text-warning py-1 pl-3 text-right tabular-nums">12 345,67 zł</td>
            </tr>
          </tbody>
        </table>
      </AuditVariant>

      <AuditVariant
        letter="ab"
        label="linie „Do wypłaty (n): kwota” w przycisku link — font-normal + ton, bez tabular-nums"
        sources={['src/components/tables/users.tsx:66']}
      >
        <span className="inline-flex flex-col items-end">
          <Button variant="link" size="inline" className="flex-col items-end gap-0">
            <span className="font-normal">do wypłaty aktywne (2): 1 111,11 zł</span>
            <span className={cn('font-normal', 'text-destructive')}>
              nadpłata aktywne (1): 88,00 zł
            </span>
            <span className={cn('font-normal', 'text-muted-foreground')}>
              nadpłata zakończone (3): 12 345,67 zł
            </span>
          </Button>
        </span>
      </AuditVariant>

      <AuditVariant
        letter="ac"
        label="data w SummaryLabelCell z className tabular-nums"
        sources={['src/components/fleet/vehicle-costs.tsx:78']}
      >
        <SummaryTable cols={SUMMARY_LABEL_COL} className="w-fit">
          {DATE_SAMPLES.map((sample) => (
            <SummaryLabelCell key={sample} className="tabular-nums">
              {sample}
            </SummaryLabelCell>
          ))}
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="ad"
        label="data w SummaryLabelCell tabular-nums opakowana w OptionalLink"
        sources={['src/components/kosztorys/summary/tables/deposits-table.tsx:49']}
      >
        <SummaryTable cols={SUMMARY_LABEL_COL} className="w-fit">
          {DATE_SAMPLES.map((sample) => (
            <SummaryLabelCell key={sample} className="tabular-nums">
              <OptionalLink href="#">{sample}</OptionalLink>
            </SummaryLabelCell>
          ))}
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="ae"
        label="data w SummaryLabelCell weight=medium + tabular-nums + notka pod spodem"
        sources={['src/components/fleet/inspection-history.tsx:53']}
      >
        <SummaryTable cols={SUMMARY_LABEL_COL} className="w-fit">
          <SummaryLabelCell
            weight="medium"
            className="tabular-nums"
            note={{ text: 'Wymiana opon' }}
          >
            20.10.2026
          </SummaryLabelCell>
          <SummaryLabelCell weight="medium" className="tabular-nums" note={null}>
            1.10.2026
          </SummaryLabelCell>
          <SummaryLabelCell weight="medium" className="tabular-nums" note={null}>
            12.09.2026
          </SummaryLabelCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="af"
        label="data w SummaryLabelCell bez tabular-nums, brak → „—”"
        sources={['src/components/equipment/held-equipment-section.tsx:47']}
      >
        <SummaryTable cols={SUMMARY_LABEL_COL} className="w-fit text-sm">
          <SummaryLabelCell>20.10.2026</SummaryLabelCell>
          <SummaryLabelCell>—</SummaryLabelCell>
          <SummaryLabelCell>12.09.2026</SummaryLabelCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="ag"
        label="data w surowym <td> raportu: wyszarzona, whitespace-nowrap, bez tabular-nums"
        sources={['src/components/kosztorys/worker-report/worker-summary.tsx:109']}
      >
        <table className="w-auto min-w-64 max-sm:text-xs">
          <tbody>
            {DATE_SAMPLES.map((sample) => (
              <tr key={sample}>
                <td className={cn(LABEL, 'whitespace-nowrap')}>{sample}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AuditVariant>
    </AuditGroup>
  )
}
