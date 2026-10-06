import { fold } from '@/lib/kosztorys/fold'
import { referencesColumn } from './formula-refs'
import { HEADER_BLOCK_ROWS } from './columns'
import type { RateTabGridT } from './read-sheet'
import { resolveRates, type ResolvedRatesT } from './resolve-columns'

export type RateRowT = {
  description: string
  wToolsRate: number
  ownToolsRate: number
  // Whether the cell was typed by hand rather than computed. It no longer settles anything — it is
  // shown beside the kwota in the conflict table, so the owner arbitrating a disagreement can see
  // which side somebody actually wrote down.
  wToolsTyped: boolean
  ownToolsTyped: boolean
  // Whether the cell MOVES when Cena j.m. moves. Only a rate that does may be imported as a
  // multiplier; everything else is a frozen amount. Not the negation of `*Typed`: bez-narzędzi is
  // usually „=R−R*0,15", a formula that follows the z-narzędziami cell rather than the client price,
  // so a hand-typed z-narzędziami freezes it too.
  wToolsTracksPrice: boolean
  ownToolsTracksPrice: boolean
}

export type RateTabT = { title: string; rows: RateRowT[] }

// Why a conflict is a conflict. The two read completely differently to the owner: „disagree" is a
// question about the sheet's own answer („który cennik ma rację"), „incoherent" is a question about
// OUR read of it („ten wiersz wzięliśmy nie stamtąd, co trzeba"). Grouped by this in the report, so
// the reason is read once per group instead of once per praca.
export type RateConflictReasonT = 'disagree' | 'incoherent'

// Why a resolution came out the way it did — every value but `agree` is shown to the owner, because
// each one means the two price lists did not simply say the same thing.
export type RateDecisionKindT =
  | 'agree' // both tabs, same pair
  | 'single' // only one tab has this praca
  | 'conflict' // the cenniki don't agree, or a pair reads as misread: NOT resolved, imports blank
  | 'missing' // no tab has it: the praca imports at 0 zł

// The kinds the preview lists one by one. `agree` says nothing, and `missing` is reported as a count
// instead — on a sheet whose cenniki are unreadable EVERY praca is missing, and 400 identical lines
// would bury the handful of real disagreements this list exists to surface.
export type ReportedRateKindT = Exclude<RateDecisionKindT, 'agree' | 'missing'>

// One tab's answer for a praca nobody could resolve — every figure that was in play, with the tab it
// came from and whether it was typed or computed. The owner decides from this table; the import does
// not decide for them.
export type RateCandidateT = {
  tab: string
  wToolsRate: number
  ownToolsRate: number
  wToolsTyped: boolean
  ownToolsTyped: boolean
}

export type RateResolutionT = {
  description: string
  wToolsRate: number
  ownToolsRate: number
  kind: RateDecisionKindT
  // Carried from the row that won, because only that row's formulas say whether these two figures
  // follow Cena j.m. — see `RateRowT`.
  wToolsTracksPrice: boolean
  ownToolsTracksPrice: boolean
  sourceTab: string | null
  // Only set on `conflict`, where there is no winner — just the cenniki's answers, all of them, for
  // the owner to arbitrate in the sheet.
  candidates?: RateCandidateT[]
  conflictReason?: RateConflictReasonT
}

// A resolution worth showing to the owner — the two silent kinds are already filtered out.
export type ReportedRateResolutionT = RateResolutionT & { kind: ReportedRateKindT }

export type RateItemT = { description: string }

export const isReported = (rate: RateResolutionT): rate is ReportedRateResolutionT =>
  rate.kind !== 'agree' && rate.kind !== 'missing'

// Rates are money to six places at most; comparing raw floats would call 0.65×20 and 13 different.
const same = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6

// The praca's identity inside one tab: description plus which repetition of it this is. Descriptions
// repeat across sections („gładź" in two rooms at two prices), so neither the description alone nor
// the row index is enough — the row index in particular breaks the moment the tabs stop being
// row-for-row mirrors of each other, which nothing guarantees.
const occurrenceKey = (description: string, occurrence: number): string =>
  `${fold(description)}#${occurrence}`

function indexByOccurrence(rows: readonly RateRowT[]): Map<string, RateRowT> {
  const seen = new Map<string, number>()
  const byKey = new Map<string, RateRowT>()
  for (const row of rows) {
    const folded = fold(row.description)
    if (!folded) continue
    const occurrence = seen.get(folded) ?? 0
    seen.set(folded, occurrence + 1)
    byKey.set(occurrenceKey(row.description, occurrence), row)
  }
  return byKey
}

// A pair where the subcontractor who brings their own tools costs MORE than one we equip is
// arithmetically impossible — the tools are the difference. Such a pair means the two rate columns
// were read from a row that doesn't belong to this praca.
const isCoherent = (row: RateRowT): boolean => row.ownToolsRate <= row.wToolsRate

/**
 * The cenniki did not say one thing, so the import stops choosing: the praca enters with
 * NO stawka (0 zł, an explicit amount — never „auto", which would invent money at the investment's
 * global multiplier) and the owner fills it in. Every figure that was in play rides along, so the
 * report can name all of them and where each came from.
 */
function unresolved(
  description: string,
  pool: ReadonlyArray<{ tab: string; row: RateRowT }>,
  conflictReason: RateConflictReasonT,
): RateResolutionT {
  return {
    description,
    wToolsRate: 0,
    ownToolsRate: 0,
    kind: 'conflict',
    conflictReason,
    wToolsTracksPrice: false,
    ownToolsTracksPrice: false,
    sourceTab: null,
    candidates: pool.map(({ tab, row }) => ({
      tab,
      wToolsRate: row.wToolsRate,
      ownToolsRate: row.ownToolsRate,
      wToolsTyped: row.wToolsTyped,
      ownToolsTyped: row.ownToolsTyped,
    })),
  }
}

function decide(
  description: string,
  candidates: ReadonlyArray<{ tab: string; row: RateRowT }>,
): RateResolutionT {
  if (candidates.length === 0) {
    return {
      description,
      wToolsRate: 0,
      ownToolsRate: 0,
      kind: 'missing',
      wToolsTracksPrice: false,
      ownToolsTracksPrice: false,
      sourceTab: null,
    }
  }

  // An impossible pair is not a cennik that disagrees — it is a row we read wrong, and a read we
  // cannot trust says nothing about the rows around it either. So it goes to the owner whether it
  // stood alone or beside a tab that happened to agree with the rest.
  if (candidates.some(({ row }) => !isCoherent(row)))
    return unresolved(description, candidates, 'incoherent')

  const [first, ...rest] = candidates
  const base = {
    description,
    wToolsRate: first.row.wToolsRate,
    ownToolsRate: first.row.ownToolsRate,
    wToolsTracksPrice: first.row.wToolsTracksPrice,
    ownToolsTracksPrice: first.row.ownToolsTracksPrice,
    sourceTab: first.tab,
  }

  if (candidates.length === 1) return { ...base, kind: 'single' }

  const disagrees = rest.some(
    ({ row }) =>
      !same(row.wToolsRate, first.row.wToolsRate) ||
      !same(row.ownToolsRate, first.row.ownToolsRate),
  )
  // Every disagreement goes to the owner, including the one a hand-typed cell used to settle (owner,
  // 2026-08-19): the typed side came in LOWER than the formula it beat, which is the opposite of what
  // the rule assumed, and a pair that far apart is as likely to be a misread row as a decision. The
  // rule also cannot see WHICH plane was typed — it read „ta zakładka jest ręczna" off either cell.
  return disagrees ? unresolved(description, candidates, 'disagree') : { ...base, kind: 'agree' }
}

/**
 * Every readable „zakres pracy" tab, plus a note for each one that could not be read. Shared by the
 * import and by „Porównaj z arkuszem" so the two can never resolve a stawka differently — they part
 * ways only on what an empty result means: the import refuses (it would write 400 zeroes), the
 * comparison reports that it has nothing to say about stawki.
 */
export function readRateTabs(grids: readonly RateTabGridT[]): {
  tabs: RateTabT[]
  warnings: string[]
} {
  const tabs: RateTabT[] = []
  const warnings: string[] = []

  for (const tab of grids) {
    const resolved = resolveRates(tab.grid)
    if (!resolved.ok) {
      warnings.push(`Pominięto zakładkę „${tab.title}": ${resolved.problems.join(' ')}`)
      continue
    }
    tabs.push({ title: tab.title, rows: readRateRows(tab.grid, tab.formulas, resolved) })
  }

  return { tabs, warnings }
}

// Resolve one rate pair per praca. `tabs` is in PRIORITY order — the first tab supplies the value
// whenever the tabs say the same thing and one of them had to be named as the source. It does NOT
// break a tie: cenniki that disagree resolve to no stawka at all. The caller orders them; see
// `build-import-plan`.
export function resolveItemRates(
  items: readonly RateItemT[],
  tabs: readonly RateTabT[],
): RateResolutionT[] {
  const indexed = tabs.map((tab) => ({ title: tab.title, byKey: indexByOccurrence(tab.rows) }))
  const seen = new Map<string, number>()

  return items.map((item) => {
    const folded = fold(item.description)
    const occurrence = seen.get(folded) ?? 0
    seen.set(folded, occurrence + 1)
    const key = occurrenceKey(item.description, occurrence)

    const candidates = indexed.flatMap(({ title, byKey }) => {
      const row = byKey.get(key)
      return row ? [{ tab: title, row }] : []
    })
    return decide(item.description, candidates)
  })
}

// Turn one „zakres pracy" tab into rate rows. `formulas` is the same grid fetched with the formula
// render, which is the only way to tell a hand-typed rate from a computed one — the value render
// returns 13 either way.
export function readRateRows(
  grid: unknown[][],
  formulas: unknown[][],
  resolved: ResolvedRatesT,
): RateRowT[] {
  const { description, wToolsRate, ownToolsRate } = resolved.columns
  const referencesWTools = referencesColumn(wToolsRate)
  const rows: RateRowT[] = []

  for (let rowIndex = HEADER_BLOCK_ROWS; rowIndex < grid.length; rowIndex++) {
    const row = grid[rowIndex] ?? []
    const label = typeof row[description] === 'string' ? row[description].trim() : ''
    if (!label) continue

    const formulaRow = formulas[rowIndex] ?? []
    const isTyped = (column: number): boolean => {
      const cell = formulaRow[column]
      return cell != null && cell !== '' && !(typeof cell === 'string' && cell.startsWith('='))
    }
    const value = (column: number): number =>
      typeof row[column] === 'number' ? row[column] : Number(row[column]) || 0

    // Bez-narzędzi is „=R−R*0,15" far more often than it is a markup on Cena j.m., so it is only as
    // free as the cell it points at. Anything else computed is taken to follow the client price.
    const wToolsTyped = isTyped(wToolsRate)
    const ownToolsTyped = isTyped(ownToolsRate)
    const wToolsTracksPrice = !wToolsTyped
    const ownToolsTracksPrice =
      !ownToolsTyped && (referencesWTools(formulaRow[ownToolsRate]) ? wToolsTracksPrice : true)

    rows.push({
      description: label,
      wToolsRate: value(wToolsRate),
      ownToolsRate: value(ownToolsRate),
      wToolsTyped,
      ownToolsTyped,
      wToolsTracksPrice,
      ownToolsTracksPrice,
    })
  }

  return rows
}
