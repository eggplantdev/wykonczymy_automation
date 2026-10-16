'use client'

import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/report/sheet-report-block'
import {
  ReportFold,
  ReportRow,
  ReportTable,
} from '@/components/kosztorys/editor/dialogs/report/sheet-report-parts'
import {
  ratesVerdict,
  type RatesReportModeT,
} from '@/components/kosztorys/editor/dialogs/sheet/sheet-rates-verdict'
import { MONEY_TOLERANCE } from '@/lib/kosztorys/calc'
import { PLANE_LABELS } from '@/lib/kosztorys/labels'
import type { StaleRateT } from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import type {
  RateConflictReasonT,
  ReportedRateResolutionT,
} from '@/lib/kosztorys/sheet-import/resolve-rates'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'

type PropsT = {
  mode: RatesReportModeT
  decisions: ReportedRateResolutionT[] | null
  stale?: StaleRateT[]
}

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
          summary={`Stawki z jednego cennika (${singles.length}) — druga zakładka nie ma tej pracy`}
        >
          <RatesByTabTable rows={singles.map(singleRow)} />
        </ReportFold>
      )}
    </SheetReportBlock>
  )
}

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

const shortTab = (tab: string): string =>
  tab.trim().replace(/^zakres\s+pracy\s*/i, '') || tab.trim()

function TabHeader({ tab, plane }: { tab: string; plane: string }) {
  return (
    <>
      <span className="block whitespace-nowrap">{plane}</span>
      <span className="block font-normal">cennik „{shortTab(tab)}"</span>
    </>
  )
}

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
