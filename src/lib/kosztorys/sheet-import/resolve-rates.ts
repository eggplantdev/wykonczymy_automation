import { fold } from '@/lib/kosztorys/fold'
import { referencesColumn } from './formula-refs'
import { HEADER_BLOCK_ROWS } from './columns'
import type { RateTabGridT } from './read-sheet'
import { resolveRates, type ResolvedRatesT } from './resolve-columns'

export type RateRowT = {
  description: string
  wToolsRate: number
  ownToolsRate: number
  wToolsTyped: boolean
  ownToolsTyped: boolean
  // Only a rate that does may be imported as a multiplier; everything else is a frozen amount.
  wToolsTracksPrice: boolean
  ownToolsTracksPrice: boolean
}

export type RateTabT = { title: string; rows: RateRowT[] }

export type RateConflictReasonT = 'disagree' | 'incoherent'

export type RateDecisionKindT =
  | 'agree' // both tabs, same pair
  | 'single' // only one tab has this praca
  | 'conflict' // the cenniki don't agree, or a pair reads as misread: NOT resolved, imports blank
  | 'missing' // no tab has it: the praca imports at 0 zł

// `missing` is reported as a count instead — on a sheet whose cenniki are unreadable EVERY praca is missing, and 400 identical lines
// would bury the handful of real disagreements this list exists to surface.
export type ReportedRateKindT = Exclude<RateDecisionKindT, 'agree' | 'missing'>

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
  wToolsTracksPrice: boolean
  ownToolsTracksPrice: boolean
  sourceTab: string | null
  candidates?: RateCandidateT[]
  conflictReason?: RateConflictReasonT
}

export type ReportedRateResolutionT = RateResolutionT & { kind: ReportedRateKindT }

export type RateItemT = { description: string }

export const isReported = (rate: RateResolutionT): rate is ReportedRateResolutionT =>
  rate.kind !== 'agree' && rate.kind !== 'missing'

// Rates are money to six places at most; comparing raw floats would call 0.65×20 and 13 different.
const same = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6

// Descriptions repeat across sections („gładź" in two rooms at two prices), so neither the
// description alone nor the row index is enough — the row index in particular breaks the moment the
// tabs stop being row-for-row mirrors of each other, which nothing guarantees.
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
// arithmetically impossible — the tools are the difference.
const isCoherent = (row: RateRowT): boolean => row.ownToolsRate <= row.wToolsRate

/**
 * The cenniki did not say one thing: the praca enters with NO stawka (0 zł, an explicit amount —
 * never „auto", which would invent money at the investment's global multiplier).
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
  return disagrees ? unresolved(description, candidates, 'disagree') : { ...base, kind: 'agree' }
}

/** Shared by the import and by „Porównaj z arkuszem" so the two can never resolve a stawka differently. */
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

// `formulas` is the same grid fetched with the formula render, which is the only way to tell a
// hand-typed rate from a computed one.
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
    // free as the cell it points at.
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
