import { InfoList } from '@/components/ui/info-list'
import { OptionalLink } from '@/components/ui/optional-link'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { SUMMARY_VALUE_COL, SummaryTable, SummaryValueCell } from '@/components/ui/summary-grid'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A01EmptyValueGroup() {
  return (
    <AuditGroup
      id="A01"
      title="Pusta wartość „—”"
      count="89 wystąpień w 49 plikach · 15 wersji"
      drift={[
        'Kolor: dziedziczony (większość komórek) vs text-muted-foreground vs opacity-40 (SummaryValueCell muted) — nawet w jednej tabeli (sprzęt: „Nr seryjny” zwykły, kolumna obok wyszarzona).',
        'Rozmiar: text-xs tylko w komórkach sprzętu, floty i inwestycji; reszta dziedziczy.',
        "Znak: „—” vs „×” (wpłaty) vs pusta komórka '' (transakcje, siatka kosztorysu) vs słowa („brak danych”, „bez terminu”, „brak kosztorysu”, „nie policzyliśmy”…).",
        'Opakowanie: goły tekst, <span>, whitespace-nowrap, break-words, whitespace-pre-line, <div>, ReadOnlyCellText, komórki SummaryGrid, InfoList, OptionalLink.',
        'Operator: || vs ?? vs == null — przy ?? pusty napis daje pustą komórkę zamiast „—”.',
        "Osobne zastępniki obok EMPTY_VALUE: fmtOrDash, NOT_APPLICABLE, formatPLNOrDash, formatKmOrDash i kolejne zwroty '—' w lib/.",
      ]}
      proposal={
        <>
          <code>{'<EmptyValue />'}</code> dostaje <code>children?</code> dla słownych zastępników
          typu „brak danych”, a <code>lib/</code> helper <code>orDash(value, format?)</code> dla
          miejsc, gdzie potrzebny jest tekst (druk, InfoList, helpery formatujące).
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="goły tekst „—” w komórce (kolor dziedziczony; || / ?? / == null / ternary)"
        sources={[
          'src/components/tables/investments.tsx:291',
          'src/components/tables/investments.tsx:307',
          'src/components/tables/investments.tsx:312',
          'src/components/tables/cash-registers.tsx:32',
          'src/components/tables/leads.tsx:63',
          'src/components/tables/leads.tsx:86',
          'src/components/tables/leads.tsx:94',
          'src/components/tables/users.tsx:150',
          'src/components/tables/users.tsx:158',
          'src/components/tables/presets.tsx:22',
          'src/components/tables/telmak-check.tsx:54',
          'src/components/tables/expense-drafts.tsx:38',
          'src/components/tables/expense-drafts.tsx:161',
          'src/components/tables/expense-drafts.tsx:192',
          'src/components/tables/worker-reports.tsx:81',
          'src/components/tables/expense-duplicates.tsx:124',
          'src/components/leads/lead-assets-dialog.tsx:82',
          'src/lib/utils/format-currency.ts:12',
          'src/lib/utils/format-distance.ts:6',
          'src/lib/utils/get-relation-name.ts:3',
          'src/lib/kosztorys/format.ts:38',
          'src/lib/kosztorys/worker-view/summary.ts:106',
          'src/lib/transfers/transfer-text.ts:46',
          'src/lib/transfers/transfer-text.ts:55',
          'src/lib/transfers/transfer-text.ts:63',
          'src/lib/queries/transfer-mapping.ts:128',
          'src/lib/kosztorys/history/change-rows.ts:19',
          'src/lib/kosztorys/history/change-rows.ts:29',
          'src/lib/kosztorys/history/change-rows.ts:89',
          'src/lib/kosztorys/history/change-rows.ts:97',
          'src/lib/queries/cash-registers.ts:18',
          'src/lib/telmak/check-row.ts:26',
          'src/lib/telmak/compare-telmak.ts:126',
          'src/components/fleet/inspection-history.tsx:62',
          'src/components/fleet/inspection-history.tsx:68',
          'src/components/fleet/inspection-history.tsx:73',
          'src/components/fleet/inspection-history.tsx:76',
          'src/components/fleet/inspection-history.tsx:87',
          'src/components/tables/equipment.tsx:42',
          'src/components/tables/equipment.tsx:82',
          'src/components/tables/fleet.tsx:44',
          'src/components/equipment/equipment-history.tsx:29',
          'src/components/equipment/held-equipment-section.tsx:46',
          'src/components/equipment/held-equipment-section.tsx:48',
          'src/app/(frontend)/kasa/[id]/page.tsx:67',
          'src/app/(frontend)/sprzet/[id]/page.tsx:66',
          'src/components/receipt-confirmation/rejected-receipts.tsx:90',
          'src/components/investments/investment-note-body.tsx:13',
          'src/components/kosztorys/editor/dialogs/preset/reload-from-preset-dialog.tsx:163',
        ]}
      >
        —
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="wyszarzony span z samą kreską"
        sources={[
          'src/components/tables/work-catalogue.tsx:54',
          'src/components/tables/users.tsx:51',
          'src/components/forms/settle-payouts-form/settle-payouts-table.tsx:143',
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:488',
          'src/components/kosztorys/editor/dialogs/sheet/sheet-rates-block.tsx:252',
          'src/components/kosztorys/summary/tables/materials-transactions-table.tsx:72',
          'src/components/kosztorys/summary/tables/materials-transactions-table.tsx:90',
        ]}
      >
        <span className="text-muted-foreground">—</span>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="słowo zamiast kreski: wyszarzony span text-xs"
        sources={[
          'src/components/tables/investments.tsx:55',
          'src/components/tables/investments.tsx:60',
          'src/components/fleet/deadline-cell.tsx:20',
          'src/components/fleet/deadline-cell.tsx:24',
          'src/components/fleet/deadline-cell.tsx:28',
        ]}
      >
        <span className="text-muted-foreground text-xs">brak kosztorysu</span>
        <span className="text-muted-foreground text-xs">ustaw etapy</span>
        <span className="text-muted-foreground text-xs">bezterminowo</span>
        <span className="text-muted-foreground text-xs">brak danych</span>
        <span className="text-muted-foreground text-xs">bez terminu</span>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="wyszarzony span wokół „wartość || '—'” — wyszarza też prawdziwą wartość"
        sources={[
          'src/components/tables/equipment.tsx:48',
          'src/components/equipment/equipment-history.tsx:35',
          'src/components/equipment/equipment-history.tsx:40',
          'src/components/kosztorys/summary/tables/subcontractor-payouts-table.tsx:40',
        ]}
      >
        <div className="flex flex-col">
          <span className="text-muted-foreground">SN-2026-0417</span>
          <span className="text-muted-foreground">—</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="span whitespace-nowrap, „?? '—'” (pusty napis zostaje pusty)"
        sources={[
          'src/components/tables/telmak-check.tsx:67',
          'src/components/tables/expense-duplicates.tsx:112',
          'src/components/tables/expense-duplicates.tsx:117',
          'src/components/tables/expense-duplicates.tsx:122',
        ]}
      >
        <span className="whitespace-nowrap">—</span>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="słowo zamiast kreski: wyszarzony span bez text-xs (porównanie z arkuszem)"
        sources={[
          'src/components/kosztorys/editor/dialogs/sheet/sheet-compare-dialog.tsx:196',
          'src/components/kosztorys/editor/dialogs/sheet/sheet-import-dialog.tsx:368',
          'src/components/kosztorys/editor/dialogs/sheet/sheet-import-dialog.tsx:375',
        ]}
      >
        <span className="text-muted-foreground">nie policzyliśmy</span>
        <span className="text-muted-foreground">nie znaleziono</span>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="„×” zamiast kreski w SummaryValueCell (stała NOT_APPLICABLE :33 + 2 użycia)"
        sources={[
          'src/components/kosztorys/summary/tables/deposits-table.tsx:33',
          'src/components/kosztorys/summary/tables/deposits-table.tsx:90',
          'src/components/kosztorys/summary/tables/deposits-table.tsx:107',
        ]}
      >
        <SummaryTable cols={`${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`}>
          <SummaryValueCell>12 345,67</SummaryValueCell>
          <SummaryValueCell>×</SummaryValueCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="wyszarzony span text-xs z kreską"
        sources={[
          'src/components/equipment/location-cell.tsx:20',
          'src/components/equipment/warranty-cell.tsx:16',
        ]}
      >
        <span className="text-muted-foreground text-xs">—</span>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="ReadOnlyCellText muted z kreską (siatka kosztorysu)"
        sources={[
          'src/components/kosztorys/editor/grid/cells/divergence-cell.tsx:19',
          'src/components/kosztorys/editor/grid/cells/subcontractor/coeff-cell.tsx:32',
        ]}
      >
        <div className="w-32">
          <ReadOnlyCellText muted>—</ReadOnlyCellText>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="kreska w OptionalLink bez href, „?? '—'”"
        sources={[
          'src/components/receipt-confirmation/rejected-receipts.tsx:67',
          'src/components/receipt-confirmation/rejected-receipts.tsx:83',
        ]}
      >
        <OptionalLink href={undefined}>—</OptionalLink>
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="pusty napis '' zamiast kreski — komórka zostaje pusta (komórka + printValue)"
        sources={[
          'src/components/tables/transfers.tsx:209',
          'src/components/tables/transfers.tsx:213',
        ]}
      >
        {''}
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="pusty napis '' w ReadOnlyCellText (format kolumny wyliczanej, :259 z tone danger)"
        sources={[
          'src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:173',
          'src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:259',
        ]}
      >
        <div className="w-32">
          <ReadOnlyCellText>{''}</ReadOnlyCellText>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="m"
        label="lokalny helper fmtOrDash → ReadOnlyCellText (domyślny format computedColumn)"
        sources={[
          'src/components/kosztorys/editor/grid/cells/computed-cell.tsx:9',
          'src/components/kosztorys/editor/grid/cells/computed-cell.tsx:58',
        ]}
      >
        <div className="w-32">
          <ReadOnlyCellText>—</ReadOnlyCellText>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="n"
        label="SummaryValueCell muted (opacity-40) z kreską"
        sources={['src/components/kosztorys/summary/blocks/subcontractor-stage-breakdown.tsx:41']}
      >
        <SummaryTable cols={`${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`}>
          <SummaryValueCell note={{ text: '42%' }}>5 180,00</SummaryValueCell>
          <SummaryValueCell muted note={null}>
            —
          </SummaryValueCell>
        </SummaryTable>
      </AuditVariant>

      <AuditVariant
        letter="o"
        label="span break-words, „?? '—'”"
        sources={['src/components/tables/expense-drafts.tsx:152']}
      >
        <span className="break-words">—</span>
      </AuditVariant>
    </AuditGroup>
  )
}
