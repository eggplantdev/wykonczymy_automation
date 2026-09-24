'use client'

import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import {
  ReportFold,
  ReportRow,
  ReportTable,
} from '@/components/kosztorys/editor/dialogs/sheet-report-parts'
import {
  ratesVerdict,
  type RatesReportModeT,
} from '@/components/kosztorys/editor/dialogs/sheet-rates-verdict'
import { MONEY_TOLERANCE } from '@/lib/kosztorys/calc'
import { PLANE_LABELS } from '@/lib/kosztorys/constants'
import type { StaleRateT } from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import type {
  RateConflictReasonT,
  ReportedRateResolutionT,
} from '@/lib/kosztorys/sheet-import/resolve-rates'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'

type PropsT = {
  // Which dialog is rendering this. The comparison writes nothing, so it must not speak about what
  // „wejdzie" — the same sentence there promises a save the dialog has no button for.
  mode: RatesReportModeT
  // Every resolution that was not a plain agreement between the two cenniki. `null` says no cennik
  // could be read at all — a different statement from „the cenniki agreed", and the only honest one
  // on a sheet whose „zakres pracy" header is broken.
  decisions: ReportedRateResolutionT[] | null
  // „Porównaj z arkuszem" only: stawki the kosztorys holds that the cennik no longer says. The import
  // preview has no counterpart — it is about to overwrite every stawka anyway.
  stale?: StaleRateT[]
}

/**
 * „Stawki podwykonawców" in both sheet dialogs. Shared rather than written twice because the two
 * dialogs answer the same question from opposite ends: the import asks which stawka it is about to
 * write, the comparison asks whether the one already written still matches the cennik. A second
 * implementation would have drifted on the wording of the very column that decides a crew's bill.
 */
export function SheetRatesBlock({ mode, decisions, stale = [] }: PropsT) {
  const conflicts = decisions?.filter((rate) => rate.kind === 'conflict') ?? []
  const singles = decisions?.filter((rate) => rate.kind === 'single') ?? []

  return (
    <SheetReportBlock
      title="Stawki podwykonawców"
      status={decisions === null || conflicts.length > 0 || stale.length > 0 ? 'warn' : 'ok'}
      verdict={ratesVerdict(mode, decisions, stale, conflicts.length)}
    >
      {stale.length > 0 && (
        <ReportFold summary={`Stawki inne niż w cenniku (${stale.length}) — zobacz które`}>
          <ReportTable headers={['Praca', PLANE_LABELS.w_tools, PLANE_LABELS.own_tools]}>
            {stale.map((rate, index) => (
              <ReportRow
                key={`${index}-${rate.description}`}
                label={
                  <>
                    <span>{rate.description}</span>
                    <span className="text-muted-foreground block text-xs">{rate.section}</span>
                  </>
                }
                cells={[
                  { content: <RatePair sheet={rate.sheetWTools} app={rate.appWTools} /> },
                  { content: <RatePair sheet={rate.sheetOwnTools} app={rate.appOwnTools} /> },
                ]}
              />
            ))}
          </ReportTable>
        </ReportFold>
      )}

      <ConflictFold
        mode={mode}
        reason="disagree"
        rows={conflicts.filter((rate) => rate.conflictReason !== 'incoherent')}
      />
      <ConflictFold
        mode={mode}
        reason="incoherent"
        rows={conflicts.filter((rate) => rate.conflictReason === 'incoherent')}
      />

      {singles.length > 0 && (
        <ReportFold
          tone="text-muted-foreground"
          // Nothing was decided here — these prace stand in one cennik only, so there was never a
          // second kwota to weigh. Said plainly, because the fold used to promise „rozstrzygnięte
          // automatycznie" and that is now something the import never does.
          summary={`Stawki z jednego cennika (${singles.length}) — druga zakładka nie ma tej pracy`}
        >
          <RatesByTabTable rows={singles.map(singleRow)} />
        </ReportFold>
      )}
    </SheetReportBlock>
  )
}

/**
 * One reason a praca has no stawka, as its own fold. Two reasons, two folds rather than a column
 * saying which is which: „cenniki się nie zgadzają" is a question about the sheet, „para jest
 * niemożliwa" is a question about our read of it, and each needs a different paragraph under the
 * table. Per-row it would be the same sentence repeated down the list.
 */
function ConflictFold({
  mode,
  reason,
  rows,
}: {
  mode: RatesReportModeT
  reason: RateConflictReasonT
  rows: ReportedRateResolutionT[]
}) {
  if (rows.length === 0) return null

  const summary =
    reason === 'disagree'
      ? `Stawki bez rozstrzygnięcia (${rows.length}) — cenniki podają różne kwoty`
      : `Stawki bez rozstrzygnięcia (${rows.length}) — para niemożliwa, zły odczyt wiersza`

  return (
    <ReportFold summary={mode === 'import' ? `${summary}, wejdą puste` : summary}>
      <RatesByTabTable rows={rows.map(conflictRow)} />
      <p className="text-muted-foreground text-xs">
        {reason === 'disagree' ? (
          // The one thing nobody guesses from the table: „zakres pracy z narzędziami" and „zakres
          // pracy bez narzędzi" are two catalogues of the SAME prace, and each carries BOTH price
          // columns. So the tab name in a row says which catalogue we read, never which column.
          <>
            Obie zakładki „zakres pracy" mają obie kolumny — i „z narzędziami", i „bez narzędzi" —
            więc każda z nich sama w sobie wystarczy. Gdy podają różne kwoty, nie wybieramy za
            Ciebie. Pusta komórka w cenniku też liczy się jako rozbieżność — arkusz pokazuje ją jako
            0 zł i nie da się jej odróżnić od pracy faktycznie za darmo.{' '}
          </>
        ) : (
          <>
            Wykonawca z własnym sprzętem nie może być droższy od takiego, któremu sprzęt dajemy —
            narzędzia są całą różnicą. Taka para znaczy, że obie kwoty przyszły z wierszy, które do
            siebie nie należą, więc nie bierzemy z tego cennika nic.{' '}
          </>
        )}
        {mode === 'import'
          ? 'Te prace wejdą bez stawki wykonawcy (0 zł) i czekają na uzupełnienie.'
          : 'Dla tych prac arkusz nie podaje jednej stawki wykonawcy, więc nie ma z czym porównać kosztorysu.'}{' '}
        Znajdziesz je w kosztorysie przez „Problemy → bez ceny wykonawcy".
      </p>
    </ReportFold>
  )
}

// One praca as the table renders it: what each zakładka said, keyed by the zakładka's own name. The
// note under a kwota answers a different question per fold — „wpisana ręcznie / z formuły" where the
// owner has to arbitrate, „jedyny cennik" where there was nothing to weigh.
//
// The tone is PER PLANE, because a conflict almost never covers both: the cenniki agree on
// „z narzędziami" and part ways on „bez narzędzi", and colouring the whole pair red would hide which
// of the two the owner actually has to settle.
type RateToneT = 'taken' | 'match' | 'differs'

type TabbedRateCellT = {
  wToolsRate: number
  ownToolsRate: number
  note: string
  wToolsTone?: RateToneT
  ownToolsTone?: RateToneT
}

type TabbedRateRowT = {
  description: string
  byTab: Map<string, TabbedRateCellT>
}

const conflictRow = (rate: ReportedRateResolutionT): TabbedRateRowT => {
  const candidates = rate.candidates ?? []
  // With one cennik there is nothing to compare against, so neither plane gets a colour — the row is
  // here because its own pair is impossible, not because two zakładki disagreed.
  const tone = (plane: 'wToolsRate' | 'ownToolsRate'): RateToneT | undefined => {
    if (candidates.length < 2) return undefined
    return candidates.every((candidate) => same(candidate[plane], candidates[0][plane]))
      ? 'match'
      : 'differs'
  }
  const wToolsTone = tone('wToolsRate')
  const ownToolsTone = tone('ownToolsRate')

  return {
    description: rate.description,
    byTab: new Map(
      candidates.map((candidate) => [
        candidate.tab,
        {
          wToolsRate: candidate.wToolsRate,
          ownToolsRate: candidate.ownToolsRate,
          // Both planes of one zakładka are read from one row, and in practice a row is typed or
          // computed as a whole — one note per pair rather than two identical ones per kwota.
          note: candidate.wToolsTyped || candidate.ownToolsTyped ? 'wpisana ręcznie' : 'z formuły',
          wToolsTone,
          ownToolsTone,
        },
      ]),
    ),
  }
}

// Kwoty are money to six places at most; comparing raw floats would call 0,65×20 and 13 different.
const same = (left: number, right: number): boolean => Math.abs(left - right) < 1e-6

const singleRow = (rate: ReportedRateResolutionT): TabbedRateRowT => ({
  description: rate.description,
  byTab: new Map(
    rate.sourceTab
      ? [
          [
            rate.sourceTab,
            {
              wToolsRate: rate.wToolsRate,
              ownToolsRate: rate.ownToolsRate,
              note: 'jedyny cennik',
              wToolsTone: 'taken',
              ownToolsTone: 'taken',
            },
          ],
        ]
      : [],
  ),
})

/**
 * Every kwota that was in play, one praca per row and one column pair per zakładka — so the four
 * figures the owner compares sit next to each other instead of in a nested table or in a prose
 * sub-line („pominięto 1625,00 zł / 1381,25 zł z …"), which is what both folds used to do and what
 * made them read as two unrelated reports.
 *
 * Columns come from the rows themselves: a praca listed in only one cennik leaves the other pair
 * empty rather than pretending it said 0 zł.
 */
function RatesByTabTable({ rows }: { rows: TabbedRateRowT[] }) {
  const tabs = [...new Set(rows.flatMap((row) => [...row.byTab.keys()]))]

  return (
    <ReportTable
      headers={[
        'Praca',
        ...tabs.flatMap((tab) => [
          <TabHeader key={`${tab}-w`} tab={tab} plane={PLANE_LABELS.w_tools} />,
          <TabHeader key={`${tab}-own`} tab={tab} plane={PLANE_LABELS.own_tools} />,
        ]),
      ]}
    >
      {rows.map((row, index) => (
        <ReportRow
          key={`${index}-${row.description}`}
          label={row.description}
          cells={tabs.flatMap((tab) => {
            const cell = row.byTab.get(tab)
            return [
              {
                content: (
                  <RateCell rate={cell?.wToolsRate} note={cell?.note} tone={cell?.wToolsTone} />
                ),
              },
              {
                content: (
                  <RateCell rate={cell?.ownToolsRate} note={cell?.note} tone={cell?.ownToolsTone} />
                ),
              },
            ]
          })}
        />
      ))}
    </ReportTable>
  )
}

// The zakładka above the plane, both in the header: repeating „z zakładki …" on every row is what
// pushed the kwoty apart in the first place.
// „zakres pracy" opens every cennik tab, so in a header repeated four times it is pure width — what
// tells the two apart is the tail. Kept as a fallback if a tab is ever named something else.
const shortTab = (tab: string): string =>
  tab.trim().replace(/^zakres\s+pracy\s*/i, '') || tab.trim()

function TabHeader({ tab, plane }: { tab: string; plane: string }) {
  // The plane never wraps — broken over two lines it reads as two headings. The cennik name below it
  // may wrap; it is the qualifier, not the column's identity.
  return (
    <>
      <span className="block whitespace-nowrap">{plane}</span>
      <span className="block font-normal">cennik „{shortTab(tab)}"</span>
    </>
  )
}

// Colour answers the question the owner opens the fold with, at the level they have to act on:
// green „ta kwota jest w kosztorysie / tu obie zakładki mówią to samo", red „te dwie kwoty się
// rozjeżdżają — to tę parę rozstrzygasz".
const TONE_CLASS: Record<RateToneT, string> = {
  taken: 'text-green-600',
  match: 'text-green-600',
  differs: 'text-red-600',
}

function RateCell({ rate, note, tone }: { rate?: number; note?: string; tone?: RateToneT }) {
  if (rate === undefined) return <span className="text-muted-foreground">—</span>
  const toneClass = tone ? TONE_CLASS[tone] : undefined
  return (
    <>
      <span className={cn('whitespace-nowrap', toneClass)}>{formatPLN(rate)}</span>
      <span className={cn('block text-xs whitespace-nowrap', toneClass ?? 'text-muted-foreground')}>
        {note}
      </span>
    </>
  )
}

// The cennik's figure over the kosztorys's, so a scan down the column reads as one pair per praca.
// An unchanged plane still prints both — otherwise the eye cannot tell „the same" from „not read".
function RatePair({ sheet, app }: { sheet: number; app: number }) {
  return (
    <>
      <span className={Math.abs(sheet - app) < MONEY_TOLERANCE ? undefined : 'text-amber-600'}>
        {formatPLN(sheet)}
      </span>
      <span className="text-muted-foreground block text-xs">{formatPLN(app)} w kosztorysie</span>
    </>
  )
}
