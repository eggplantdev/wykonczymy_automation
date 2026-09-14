'use client'

import { SheetAccessBlock } from '@/components/kosztorys/editor/dialogs/sheet-access-block'
import { SheetProblemsBlock } from '@/components/kosztorys/editor/dialogs/sheet-problems-block'
import { SheetRatesBlock } from '@/components/kosztorys/editor/dialogs/sheet-rates-block'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import { SheetReportDialog } from '@/components/kosztorys/editor/dialogs/sheet-report-dialog'
import {
  ComparisonRow,
  ComparisonTable,
  ItemList,
  ReportFold,
} from '@/components/kosztorys/editor/dialogs/sheet-report-parts'
import { itemHasPhrase, itemNoun, itemNounLocative } from '@/lib/kosztorys/counted-nouns'
import type { SheetCompareResultT } from '@/lib/actions/kosztorys-import'
import { MONEY_TOLERANCE } from '@/lib/kosztorys/calc'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import type {
  ComparedItemT,
  ExecutedDiffT,
  SheetComparisonT,
} from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import {
  footerDisagreements,
  type FooterComparisonT,
} from '@/lib/kosztorys/sheet-import/footer-totals'
import type { FormulaSampleT } from '@/lib/kosztorys/sheet-import/formula-health'
import { formatQty } from '@/lib/kosztorys/format'
import { formatPLN } from '@/lib/utils/format-currency'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

/**
 * „Porównaj z arkuszem" — a live read of the sheet against the stored kosztorys, which also pulls the
 * sheet's Pomiar onto the stored reference figure. Renders a record it does not compute: everything
 * here comes from the action, fetched by the parent on the click (a programmatically-opened Radix
 * dialog never fires `onOpenChange`, so it cannot fetch itself).
 *
 * Answers three questions in order — do the two sides agree on the money, do they hold the same
 * prace, and where did our reading of the sheet have to differ from what it shows. It closes on what
 * the refresh wrote: this window is the only thing that touches the stored Pomiar, so a read-shaped
 * dialog that writes in silence would leave the owner no way to tell it apart from one that doesn't.
 */
export function SheetCompareDialog() {
  const { investmentId } = useKosztorysEditorContext()
  // `read` re-runs the comparison with the new pointing in place — same window, no reopen.
  const {
    open,
    setOpen: onOpenChange,
    result,
    error,
    loaded,
    read,
  } = useKosztorysActions().sheetCompare

  return (
    <SheetReportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Porównaj z arkuszem Google"
      description="Czy arkusz Google i ta aplikacja liczą to samo — i gdzie się rozjeżdżają."
      loaded={loaded}
      data={result}
      error={error}
    >
      {({ comparison, refresh, problems, columns, failure }) =>
        failure ? (
          <SheetAccessBlock failure={failure} />
        ) : problems.length > 0 ? (
          <SheetProblemsBlock
            investmentId={investmentId}
            problems={problems}
            columns={columns}
            consequence="nic nie zostało zmienione"
            onMappingSaved={read}
          />
        ) : !comparison || !refresh ? (
          <p className="text-muted-foreground text-sm">
            Arkusz Google odczytany, ale porównanie nie wróciło — spróbuj ponownie.
          </p>
        ) : (
          <>
            <MoneyBlock comparison={comparison} />
            <SheetFooterBlock footer={comparison.footer} />
            <ItemsBlock comparison={comparison} />
            <SheetRatesBlock
              mode="compare"
              decisions={comparison.rates.decisions}
              stale={comparison.rates.stale}
            />
            <ReadingBlock comparison={comparison} />
            <RefreshLine refresh={refresh} />
          </>
        )
      }
    </SheetReportDialog>
  )
}

/**
 * Only the executed work is compared. The offered scope reads the same column on both sides, so it
 * can disagree only when a praca is missing altogether — which the „Prace" block already says,
 * and the sheet never totals that column anyway.
 */
function MoneyBlock({ comparison }: { comparison: SheetComparisonT }) {
  const { totals, footer } = comparison
  const executed = totals.executedNetFromSheet - totals.executedNetFromApp
  const agree = Math.abs(executed) < MONEY_TOLERANCE

  // The sheet sums its prace twice: once off Pomiar z natury („wartość netto") and once off the
  // etapy („R netto"). The gap between the two is its own „pozostało do rozliczenia" — work measured
  // but not yet assigned to an etap, a state this app cannot hold, which is why the same subtraction
  // against our executed total is the honest counterpart rather than a second comparison.
  // Only when the row turned out to hold the measured total. `matchedAgainst` exists because the
  // same „wartość netto" row totals the OFFER on some clients' sheets — reading it as measured work
  // there would print the whole unexecuted scope under a label calling it work already done.
  const netValueRow = footer.find((total) => total.key === 'plannedNet')
  const sheetMeasured =
    netValueRow?.matchedAgainst === 'measuredNet' ? netValueRow.sheetValue : null
  // Same guard, same reason: a „R netto" that sums the wrong columns states a figure which is not
  // the executed work, and subtracting it would print a „Rozjazd" nobody's sheet contains.
  const executedRow = footer.find((total) => total.key === 'executedNet')
  const sheetExecuted =
    executedRow?.matchedAgainst === 'executedNet' ? executedRow.sheetValue : null
  const unassignedInSheet =
    sheetMeasured === null || sheetExecuted === null ? null : sheetMeasured - sheetExecuted
  const unassignedHere = sheetMeasured === null ? null : sheetMeasured - totals.executedNetFromApp

  return (
    <SheetReportBlock
      title="Kwoty"
      status={agree ? 'ok' : 'warn'}
      verdict={executedVerdict(executed)}
    >
      <ComparisonTable>
        <ComparisonRow
          label="Wartość prac wykonanych"
          sheet={formatPLN(totals.executedNetFromSheet)}
          app={formatPLN(totals.executedNetFromApp)}
          delta={agree ? null : formatPLN(executed)}
        />
        {unassignedInSheet !== null && unassignedHere !== null && (
          <ComparisonRow
            label={COLUMN_LABELS.divergence}
            sheet={formatPLN(unassignedInSheet)}
            app={formatPLN(unassignedHere)}
            delta={agree ? null : formatPLN(unassignedInSheet - unassignedHere)}
          />
        )}
      </ComparisonTable>

      <ExecutedDiffList diffs={comparison.executedDiffs} link={comparison.sheetLink} />

      {unassignedInSheet !== null && (
        <p className="text-muted-foreground text-xs">
          „{COLUMN_LABELS.divergence}" to praca zmierzona w arkuszu Google, której nie rozpisano
          jeszcze na żaden etap.
        </p>
      )}
      {comparison.globalDiscountMismatch && (
        <p className="text-destructive text-xs">
          Ta inwestycja ma aktywny rabat globalny, więc kwoty w tym oknie rozjeżdżają się z tymi w
          kosztorysie. Tutaj każda praca liczy się ze swoim własnym rabatem, tak jak w arkuszu
          Google — rabat globalny nie wchodzi. W kosztorysie jest odwrotnie: prace idą bez rabatu, a
          rabat globalny schodzi raz od sumy.
        </p>
      )}
    </SheetReportBlock>
  )
}

// The sign says which side is ahead, so it is named rather than left as a bare `< 0` in the middle
// of a ternary — reading it backwards would tell the owner the wrong side is behind on its etapy.
function executedVerdict(executed: number): string {
  if (Math.abs(executed) < MONEY_TOLERANCE)
    return 'Obie strony policzyły tyle samo prac wykonanych.'
  if (executed < 0)
    return `Tutaj rozpisano na etapy o ${formatPLN(-executed)} więcej pracy niż w arkuszu Google.`
  return `W arkuszu Google rozpisano na etapy o ${formatPLN(executed)} więcej pracy niż tutaj.`
}

/**
 * The sheet against itself: the figures typed into its summary rows against what its own prace add
 * up to. Deliberately its own block with its own column names — this is not the arkusz↔aplikacja
 * question the block above answers, and reusing those headers put one and the same figure under „Ta
 * aplikacja" here and „Arkusz Google" in the import preview.
 *
 * A disagreement points at one of two places and the dialog cannot tell them apart: the sheet's own
 * footer arithmetic (live, both cases have been that — a section left out of a hand-written SUM, and
 * a correction typed straight into a value column), or our reading of the cena/rabat columns, which
 * would make every figure in the block above wrong too. So it names both and blames neither.
 */
function SheetFooterBlock({ footer }: { footer: readonly FooterComparisonT[] }) {
  // A summary row the sheet does not carry is not a finding — see `footerDisagreements`.
  const stated = footer.filter(
    (total): total is FooterComparisonT & { sheetValue: number } => total.sheetValue !== null,
  )
  if (stated.length === 0) return null
  const disagreeing = footerDisagreements(stated)

  return (
    <SheetReportBlock
      title="Podsumowanie na dole arkusza Google"
      status={disagreeing.length === 0 ? 'ok' : 'warn'}
      verdict={
        disagreeing.length === 0
          ? 'Kwoty wpisane na dole arkusza zgadzają się z sumą jego własnych prac.'
          : 'Arkusz nie zgadza się sam ze sobą — kwoty wpisane na jego dole nie wychodzą z sumy jego własnych prac.'
      }
    >
      <ComparisonTable sides={['Wpisane na dole', 'Suma jego prac']}>
        {stated.map((total) => (
          <ComparisonRow
            key={total.key}
            label={total.label}
            sheet={formatPLN(total.sheetValue)}
            app={
              total.appValue === null ? (
                <span className="text-muted-foreground">nie policzyliśmy</span>
              ) : (
                formatPLN(total.appValue)
              )
            }
            delta={total.matches || total.delta === null ? null : formatPLN(total.delta)}
          />
        ))}
      </ComparisonTable>
      {disagreeing.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Kwot powyżej to nie zmienia — te liczymy z prac arkusza, wiersz po wierszu, a nie z jego
          podsumowania. Ale warto sprawdzić, po której stronie leży błąd: albo formuły sumujące na
          dole arkusza (pominięta sekcja, kwota wpisana ręcznie w kolumnie wartości etapu), albo
          nasz odczyt cen i rabatów — a wtedy kwoty powyżej też będą złe.
        </p>
      )}
    </SheetReportBlock>
  )
}

function ItemsBlock({ comparison }: { comparison: SheetComparisonT }) {
  const { counts, onlyInSheet, onlyInApp } = comparison
  const agree = onlyInSheet.length === 0 && onlyInApp.length === 0

  return (
    <SheetReportBlock
      title="Prace"
      status={agree ? 'ok' : 'warn'}
      verdict={
        agree
          ? `Obie strony mają te same ${counts.matched} ${itemNoun(counts.matched)}.`
          : `${counts.matched} ${itemNoun(counts.matched)} jest po obu stronach. Reszta istnieje tylko po jednej — a skoro kwoty liczą się z prac, to zwykle tu leży różnica.`
      }
    >
      {!agree && (
        <>
          <ComparisonTable>
            <ComparisonRow
              label="Ile prac w ogóle"
              sheet={`${counts.sheetItems}`}
              app={`${counts.appItems}`}
              // Equal counts with different names is the ordinary case (one praca on each side), so
              // „zgadza się" is true here — but only then. It was hardcoded, and the row read
              // „402 / 403 / zgadza się".
              delta={
                counts.sheetItems === counts.appItems
                  ? null
                  : `${counts.sheetItems - counts.appItems}`
              }
            />
          </ComparisonTable>
          <SideOnlyList
            label="Tylko w arkuszu Google — nie ma ich w aplikacji"
            items={onlyInSheet}
          />
          <SideOnlyList label="Tylko w aplikacji — nie ma ich w arkuszu Google" items={onlyInApp} />
          <p className="text-muted-foreground text-xs">
            Prace kojarzymy po nazwie sekcji i opisie, bo arkusz Google nie ma identyfikatorów.
            Poprawiona literówka w opisie wystarczy, żeby ta sama praca trafiła na obie listy.
          </p>
        </>
      )}
    </SheetReportBlock>
  )
}

/**
 * These sheets belong to the clients, have worked for years, and none of them are built the same
 * way — so this block judges our reading, never their sheet. It reports where the two models differ
 * and what that costs the comparison above; a line here is never a defect anyone is asked to fix.
 */
function ReadingBlock({ comparison }: { comparison: SheetComparisonT }) {
  const { health, sheetLink } = comparison
  const clean =
    health.measuredCopiedFromPlanned === 0 &&
    health.plannedReadFromStage === 0 &&
    health.errorValues === 0

  return (
    <SheetReportBlock
      title="Jak odczytaliśmy arkusz Google"
      status={clean ? 'ok' : 'warn'}
      verdict={
        clean
          ? 'Wszystko wzięliśmy wprost — nic po drodze nie zgadywaliśmy.'
          : 'W tych miejscach aplikacja czyta arkusz Google inaczej, niż on wygląda na ekranie. Nic tu nie jest zepsute — tyle tylko umiemy stąd wziąć, i stąd mogą brać się różnice powyżej.'
      }
    >
      {clean ? null : (
        <>
          <SampleList
            summary={`${health.errorValues} ${itemHasPhrase(health.errorValues)} w miejscu kwoty wartość błędu (#REF!, #DIV/0!) — nie ma tam liczby, więc czytamy zero.`}
            samples={health.samples.errorValue}
            link={sheetLink}
            tone="text-destructive"
          />
          <SampleList
            summary={`${health.plannedReadFromStage} ${itemHasPhrase(health.plannedReadFromStage)} Przedmiar policzony z etapu. U nas Przedmiar to osobna liczba, wpisywana ręcznie — nie zmieni się, kiedy zmienisz etap.`}
            samples={health.samples.plannedReadFromStage}
            link={sheetLink}
          />
          {health.measuredCopiedFromPlanned > 0 && (
            // A count, never a list (owner, 2026-08-14): on a blank offer sheet this is the normal
            // state of every row, so a fold to open would send them hunting through hundreds of
            // prace that are not wrong.
            <p className="text-xs text-amber-600">
              W {health.measuredCopiedFromPlanned} z {health.totalRows} prac Pomiar z natury
              wskazuje na Przedmiar. U nas pomiar to zawsze suma etapów.
            </p>
          )}
        </>
      )}
    </SheetReportBlock>
  )
}

// The one line that says this window wrote something. „Już zgodne" is the answer that matters most:
// it is what tells the owner a second look changed nothing, rather than leaving them to wonder.
function RefreshLine({ refresh }: { refresh: NonNullable<SheetCompareResultT['refresh']> }) {
  const { updated, cleared, unmatched } = refresh
  const skipped =
    unmatched > 0
      ? ` Pominięto ${unmatched} ${itemNoun(unmatched)} bez odpowiednika w arkuszu Google.`
      : ''
  return (
    <p className="text-muted-foreground text-xs">
      {updated === 0 && cleared === 0
        ? `Zapisany Pomiar z natury był już zgodny z arkuszem Google.${skipped}`
        : `Zaciągnięto Pomiar z natury: zaktualizowano ${updated}, wyczyszczono ${cleared}.${skipped}`}
    </p>
  )
}

function SampleList({
  summary,
  samples,
  link,
  tone,
}: {
  summary: string
  samples: FormulaSampleT[]
  link: SheetComparisonT['sheetLink']
  tone?: string
}) {
  if (samples.length === 0) return null
  return (
    <ReportFold summary={summary} tone={tone}>
      {samples.map((sample) => (
        <p key={sample.cell} className="text-muted-foreground text-xs">
          <SheetCellLink cell={sample.cell} link={link} /> · {sample.description}
        </p>
      ))}
    </ReportFold>
  )
}

// Where the money block's difference actually sits. Every praca that contributes is listed — the sum
// of this list IS the number in the table, so a shortened list would be a lie about a total.
function ExecutedDiffList({
  diffs,
  link,
}: {
  diffs: ExecutedDiffT[]
  link: SheetComparisonT['sheetLink']
}) {
  if (diffs.length === 0) return null
  return (
    <ReportFold
      summary={`Różnica siedzi w ${diffs.length} ${itemNounLocative(diffs.length)} — zobacz w których.`}
    >
      <ComparisonTable>
        {diffs.map((diff) => (
          <ComparisonRow
            key={diff.cell}
            label={
              <>
                <SheetCellLink cell={diff.cell} link={link} /> · {diff.section} · {diff.description}
                {diff.sheetQty === diff.appQty && (
                  <span className="text-muted-foreground">
                    {' '}
                    — ta sama ilość, więc różni się cena albo rabat
                  </span>
                )}
              </>
            }
            sheet={`${formatPLN(diff.sheetNet)} (${formatQty(diff.sheetQty)})`}
            app={`${formatPLN(diff.appNet)} (${formatQty(diff.appQty)})`}
            delta={formatPLN(diff.sheetNet - diff.appNet)}
          />
        ))}
      </ComparisonTable>
    </ReportFold>
  )
}

function SheetCellLink({ cell, link }: { cell: string; link: SheetComparisonT['sheetLink'] }) {
  if (!link) return <>komórka {cell}</>
  return (
    <a
      href={`https://docs.google.com/spreadsheets/d/${link.spreadsheetId}/edit#gid=${link.gid}&range=${cell}`}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2"
    >
      komórka {cell}
    </a>
  )
}

function SideOnlyList({ label, items }: { label: string; items: ComparedItemT[] }) {
  if (items.length === 0) return null
  return (
    <ReportFold
      tone="text-muted-foreground"
      summary={
        <span className="text-foreground text-xs font-medium">
          {label} ({items.length})
        </span>
      }
    >
      <ItemList items={items} />
    </ReportFold>
  )
}
