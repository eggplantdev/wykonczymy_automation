'use client'

import { useState, useTransition } from 'react'
import { DialogActions } from '@/components/ui/dialog-actions'
import { SheetAccessBlock } from '@/components/kosztorys/editor/dialogs/sheet-access-block'
import { SheetColumnPicker } from '@/components/kosztorys/editor/dialogs/sheet-column-picker'
import { evaluateImportGate } from '@/components/kosztorys/editor/dialogs/sheet-import-gate'
import { SheetPointedColumnsBlock } from '@/components/kosztorys/editor/dialogs/sheet-pointed-columns-block'
import { SheetProblemsBlock } from '@/components/kosztorys/editor/dialogs/sheet-problems-block'
import { SheetRatesBlock } from '@/components/kosztorys/editor/dialogs/sheet-rates-block'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import { SheetReportDialog } from '@/components/kosztorys/editor/dialogs/sheet-report-dialog'
import {
  ComparisonRow,
  ComparisonTable,
  ItemList,
  ReportFold,
  ReportRow,
  ReportTable,
} from '@/components/kosztorys/editor/dialogs/sheet-report-parts'
import { columnNoun, itemNoun, itemVanishesPhrase } from '@/lib/kosztorys/counted-nouns'
import { applyKosztorysImport, type ImportPreviewT } from '@/lib/actions/kosztorys-import'
import { PLANE_LABELS, TOOL_PLANES } from '@/lib/kosztorys/constants'
import { formatCoeff } from '@/lib/kosztorys/format'
import type { ImportReportT } from '@/lib/kosztorys/sheet-import/build-import-plan'
import type { FooterComparisonT } from '@/lib/kosztorys/sheet-import/footer-totals'
import type {
  UnresolvedColumnsT,
  UnresolvedReasonT,
} from '@/lib/kosztorys/sheet-import/resolve-columns'
import type { ToolPlaneT } from '@/lib/kosztorys/types'
import { SimpleSelect } from '@/components/ui/simple-select'
import { formatPLN } from '@/lib/utils/format-currency'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: ImportPreviewT | null
  error: string | null
  loaded: boolean
  onImported: () => void
  // Re-reads the sheet with the new pointing in place, so the window answers in place instead of
  // asking the owner to close it and try again.
  onMappingSaved: () => void
}

const MISSING_COLUMN_REASONS: Record<UnresolvedReasonT, string> = {
  absent: 'nie ma jej w arkuszu',
  ambiguous: 'pasuje do kilku kolumn — zmień nazwę tej drugiej',
}

// What the import would do, before it does it. The confirm re-derives everything server-side, so
// nothing rendered here is trusted on the way back.
export function SheetImportDialog({
  investmentId,
  open,
  onOpenChange,
  preview,
  error,
  loaded,
  onImported,
  onMappingSaved,
}: PropsT) {
  const [pending, startTransition] = useTransition()
  const [plane, setPlane] = useState<PlanePickT>(NO_PLANE)

  // The dialog is mounted once for both triggers, so closing it never unmounts the pick — and a
  // rozliczenie nobody chose this time would stamp every imported etap.
  const [openedWith, setOpenedWith] = useState(open)
  if (open !== openedWith) {
    setOpenedWith(open)
    if (open) setPlane(NO_PLANE)
  }

  const { confirmDisabled, mismatchedTotals } = evaluateImportGate(preview, loaded, pending)

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await applyKosztorysImport(investmentId, plane === NO_PLANE ? null : plane)
        if (!result.success) {
          toastMessage(result.error, 'error', 6000)
          return
        }
        const { sections, items, stages } = result.data
        toastMessage(`Wczytano: ${sections} sekcji · ${items} prac · ${stages} etapów`, 'success')
      } catch {
        // A transport-level rejection can arrive AFTER the replacement committed, so the grid may
        // already hold rows that no longer exist.
        toastMessage('Pobieranie przerwane — odświeżam kosztorys', 'error', 6000)
      }
      onOpenChange(false)
      onImported()
    })
  }

  return (
    <SheetReportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pobierz kosztorys z arkusza Google"
      description="Cała rozpiska zostanie zastąpiona danymi z arkusza — prac, których arkusz nie ma, nie będzie. Stan sprzed pobrania zapisze się automatycznie — wrócisz do niego przez „Wczytaj”."
      loaded={loaded}
      data={preview}
      error={error}
      actions={
        <DialogActions
          confirmLabel="Pobierz i zastąp"
          pending={pending}
          pendingLabel="Pobieram…"
          onConfirm={handleConfirm}
          onCancel={() => onOpenChange(false)}
          confirmDisabled={confirmDisabled}
        />
      }
    >
      {({ problems, report, columns, failure }) =>
        failure ? (
          <SheetAccessBlock failure={failure} />
        ) : problems.length > 0 ? (
          <SheetProblemsBlock
            investmentId={investmentId}
            problems={problems}
            columns={columns}
            consequence="nic nie zostanie nadpisane"
            onMappingSaved={onMappingSaved}
          />
        ) : (
          <>
            <ScopeBlock report={report} />
            {report.counts.stages > 0 && <PlaneBlock plane={plane} onChange={setPlane} />}
            <ColumnsBlock
              investmentId={investmentId}
              missing={report.missingColumns}
              columns={columns}
              onMappingSaved={onMappingSaved}
            />
            <SheetRatesBlock mode="import" decisions={report.rateDecisions} />
            <DroppedBlock dropped={report.dropped} />
            <TotalsBlock totals={report.totals} mismatched={mismatchedTotals} />
          </>
        )
      }
    </SheetReportDialog>
  )
}

// A value rather than an empty string, because the select needs something to render as the pick.
const NO_PLANE = 'none'
type PlanePickT = ToolPlaneT | typeof NO_PLANE

const PLANE_OPTIONS = [
  { value: NO_PLANE, label: 'Nie ustawiaj — wybiorę w kosztorysie' },
  ...TOOL_PLANES.map((plane) => ({
    value: plane,
    label: `Wszystkie ${PLANE_LABELS[plane].toLowerCase()}`,
  })),
]

// One pick for the whole kosztorys; the odd etap out gets changed in its own header afterwards.
function PlaneBlock({
  plane,
  onChange,
}: {
  plane: PlanePickT
  onChange: (plane: PlanePickT) => void
}) {
  return (
    <SheetReportBlock
      title="Rozliczenie etapów"
      verdict="Arkusz tego nie ma — ustaw raz dla wszystkich etapów. Bez tego etapy wejdą zablokowane."
    >
      <SimpleSelect
        value={plane}
        onValueChange={(value) => onChange(value as PlanePickT)}
        options={PLANE_OPTIONS}
        variant="toolbarSm"
      />
    </SheetReportBlock>
  )
}

// The warnings ride here rather than at the top: each one is a caveat about the count beside it.
function ScopeBlock({ report }: { report: ImportReportT }) {
  const { counts, warnings, coeffs } = report
  const adopted = [
    coeffs.wTools === null
      ? null
      : `${PLANE_LABELS.w_tools.toLowerCase()} ${formatCoeff(coeffs.wTools)}`,
    coeffs.ownTools === null
      ? null
      : `${PLANE_LABELS.own_tools.toLowerCase()} ${formatCoeff(coeffs.ownTools)}`,
  ].filter(Boolean)

  return (
    <SheetReportBlock
      title="Co wejdzie"
      status={warnings.length === 0 ? 'ok' : 'warn'}
      verdict={`${counts.sections} sekcji · ${counts.items} prac · ${counts.stages} etapów`}
    >
      {adopted.length > 0 && (
        <p>{`Mnożnik ceny z cennika: ${adopted.join(' · ')} — zastąpi ustawienie inwestycji.`}</p>
      )}
      {warnings.map((warning, index) => (
        <p key={`${index}-${warning}`} className="text-amber-600">
          {warning}
        </p>
      ))}
    </SheetReportBlock>
  )
}

/**
 * Only the columns we could NOT read: a required one is either resolved or the import is refused, so
 * the recognised ones say nothing. An absent optional column is data quietly missing from the
 * kosztorys, and this is the only place it is stated.
 */
function ColumnsBlock({
  investmentId,
  missing,
  columns,
  onMappingSaved,
}: {
  investmentId: number
  missing: ImportReportT['missingColumns']
  columns: UnresolvedColumnsT
  onMappingSaved: () => void
}) {
  // A pointed column is not a shortfall, but its note still renders when nothing is missing, or the
  // pick that resolved the last column takes „Usuń wskazanie" down with it.
  if (missing.length === 0) {
    return (
      <SheetPointedColumnsBlock
        investmentId={investmentId}
        columns={columns}
        onMappingSaved={onMappingSaved}
      />
    )
  }
  return (
    <SheetReportBlock
      title="Czego nie odczytaliśmy z arkusza Google"
      status="warn"
      verdict={`Brakuje ${missing.length} ${columnNoun(missing.length)}. Pobranie jest nadal możliwe — poniżej, czego zabraknie w kosztorysie.`}
    >
      <ReportTable headers={['Kolumna', 'Dlaczego', 'Skutek']}>
        {missing.map((column) => (
          <ReportRow
            key={column.label}
            label={`„${column.label}"`}
            cells={[
              { content: MISSING_COLUMN_REASONS[column.reason], tone: 'text-muted-foreground' },
              { content: column.consequence, tone: 'text-amber-600' },
            ]}
          />
        ))}
      </ReportTable>
      <SheetColumnPicker
        investmentId={investmentId}
        missing={missing.map((column) => column.field)}
        pointed={columns.pointedFields}
        candidates={columns.candidates}
        onSaved={onMappingSaved}
      />
    </SheetReportBlock>
  )
}

// The last screen before the rozpiska is replaced, so it names the loss: keeping the unmatched prace
// instead is what filled one kosztorys with 83 copies of itself.
function DroppedBlock({ dropped }: { dropped: ImportReportT['dropped'] }) {
  const clean = dropped.length === 0
  const withProgress = dropped.filter((item) => item.hasProgress).length
  return (
    <SheetReportBlock
      title="Prace, których nie ma w arkuszu Google"
      status={clean ? 'ok' : 'warn'}
      verdict={
        clean
          ? 'Każda praca z kosztorysu jest też w arkuszu.'
          : [
              `${dropped.length} ${itemVanishesPhrase(dropped.length)} — arkusz zastępuje całą rozpiskę.`,
              withProgress > 0 &&
                `W tym ${withProgress} ${itemNoun(withProgress)} z wpisanym wykonaniem.`,
              'Stan sprzed importu zapisze się automatycznie — wrócisz do niego przez „Wczytaj”. Jeśli prac jest nieoczekiwanie dużo, sprawdź, czy w arkuszu nie zmieniła się nazwa sekcji.',
            ]
              .filter(Boolean)
              .join(' ')
      }
    >
      {!clean && (
        <ReportFold summary={`Zobacz, które prace znikną (${dropped.length})`}>
          <ItemList
            items={dropped.map((item) => ({
              section: item.section,
              description: item.description,
              note: item.hasProgress ? 'wpisane etapy' : undefined,
            }))}
          />
        </ReportFold>
      )}
    </SheetReportBlock>
  )
}

/**
 * Both rows are checked against our pricing of the SHEET's own prace — the stored kosztorys never
 * enters this table — so a difference is the sheet disagreeing with itself, either because we misread
 * a cena or because its own footer arithmetic is off. Live, it has always been the latter.
 */
function TotalsBlock({
  totals,
  mismatched,
}: {
  totals: ImportReportT['totals']
  mismatched: FooterComparisonT[]
}) {
  return (
    <SheetReportBlock
      title="Porównanie sum"
      status={mismatched.length === 0 ? 'ok' : 'warn'}
      verdict={totalsVerdict(mismatched)}
    >
      <ComparisonTable>
        {totals.map((total) => (
          <ComparisonRow
            key={total.key}
            label={total.label}
            sheet={
              total.sheetValue === null ? (
                <span className="text-muted-foreground">nie znaleziono</span>
              ) : (
                formatPLN(total.sheetValue)
              )
            }
            app={
              total.appValue === null ? (
                <span className="text-muted-foreground">nie policzyliśmy</span>
              ) : (
                formatPLN(total.appValue)
              )
            }
            delta={total.delta === null || total.matches ? null : formatPLN(total.delta)}
          />
        ))}
      </ComparisonTable>
    </SheetReportBlock>
  )
}

/**
 * „wartość netto" first: it is the only one of the two that doubts the read itself, and a wrong cena
 * makes every other figure in the dialog wrong too. Neither message names the app as a side, because
 * both rows face our pricing of the sheet's own prace.
 *
 * A stale SUM in the owner's footer is common enough that blocking on it would make the button
 * useless exactly where it is needed, so neither line stops the import.
 */
function totalsVerdict(mismatched: FooterComparisonT[]): string {
  if (mismatched.some((total) => total.key === 'plannedNet'))
    return 'Kwota wpisana na dole arkusza Google nie wychodzi z sumy jego własnych prac — sprawdź formuły sumujące na dole arkusza. Pobranie jest nadal możliwe.'
  if (mismatched.some((total) => total.key === 'executedNet'))
    return 'Kwota „R netto" na dole arkusza Google nie wychodzi z sumy jego własnych etapów — sprawdź formuły sumujące na dole arkusza. Pobranie jest nadal możliwe.'
  return 'Podsumowanie arkusza Google zgadza się z tym, co policzyliśmy z jego prac.'
}
