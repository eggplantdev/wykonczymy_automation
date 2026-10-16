import { fold } from '@/lib/kosztorys/fold'
import {
  FIELD_LABELS,
  FIELD_MATCHERS,
  HEADER_BLOCK_ROWS,
  isOptionalField,
  RATE_GROUP_LABELS,
  RATE_GROUP_MATCHERS,
  RATE_UNIT_PRICE_MATCHER,
  STAGE_MARKER,
  type ColumnFieldT,
  type RateGroupT,
} from './columns'
import type { SheetColumnMappingT } from './sheet-column-mapping'
import { columnLetter } from '@/lib/google/sheet-configs'

export type StageColumnsT = { firstColumn: number; count: number }

export type ResolveFailureT = { ok: false; problems: string[] }

export type UnresolvedReasonT = 'absent' | 'ambiguous'

export type MissingFieldT = { field: ColumnFieldT; required: boolean; reason: UnresolvedReasonT }

export type CandidateColumnT = { column: number; letter: string; labels: string[] }

export type UnresolvedColumnsT = {
  // On a header that resolved these are the optional fields only — a missing required column refuses
  // the import outright.
  missingFields: MissingFieldT[]
  candidates: CandidateColumnT[]
  pointedFields: ColumnFieldT[]
}

export type LaborColumnsFailureT = ResolveFailureT & UnresolvedColumnsT

export type ResolvedLaborColumnsT = UnresolvedColumnsT & {
  ok: true
  columns: { section?: number; description: number } & Partial<Record<ColumnFieldT, number>> & {
      plannedQty: number
      unit: number
      clientPrice: number
      netValue: number
    }
  stages: StageColumnsT
}

// A rates tab carries its own „wykonano" run and it can be SHORTER than the kosztorys'; the etap
// count comes from `kosztorys_robocizny` and nowhere else.
export type ResolvedRatesT = {
  ok: true
  columns: { description: number; wToolsRate: number; ownToolsRate: number }
}

function findField(block: unknown[][], matches: (value: string) => boolean): number[] {
  const hits = new Set<number>()
  for (const row of block) {
    row.forEach((cell, column) => {
      const raw = String(cell ?? '').trim()
      if (raw && matches(fold(cell))) hits.add(column)
    })
  }
  return [...hits]
}

// Contiguous on purpose: a stray „wykonano" elsewhere in the row would otherwise stretch the range
// across unrelated columns.
function findStages(block: unknown[][]): StageColumnsT | null {
  const markerRow = block.find((row) => row.some((cell) => fold(cell) === STAGE_MARKER))
  if (!markerRow) return null

  const firstColumn = markerRow.findIndex((cell) => fold(cell) === STAGE_MARKER)
  let count = 0
  while (fold(markerRow[firstColumn + count]) === STAGE_MARKER) count += 1
  return { firstColumn, count }
}

// The etapy end where Przedmiar begins, not where the markers do. With its header overwritten the
// next field is Pomiar, and running up to that would swallow the very column the owner has to point
// Przedmiar at.
function extendToPrzedmiar(
  stages: StageColumnsT,
  columns: Partial<Record<ColumnFieldT, number>>,
): StageColumnsT {
  const markerEnd = stages.firstColumn + stages.count
  if (columns.plannedQty === undefined || columns.plannedQty < markerEnd) return stages
  const nextField = Math.min(...Object.values(columns).filter((column) => column >= markerEnd))
  return { ...stages, count: nextField - stages.firstColumn }
}

type UnresolvedFieldT = MissingFieldT & { hits: number }

function resolveFields(
  block: unknown[][],
  fields: readonly ColumnFieldT[],
): {
  columns: Partial<Record<ColumnFieldT, number>>
  unresolved: UnresolvedFieldT[]
} {
  const columns: Partial<Record<ColumnFieldT, number>> = {}
  const unresolved: UnresolvedFieldT[] = []

  for (const field of fields) {
    const hits = findField(block, FIELD_MATCHERS[field])
    if (hits.length === 1) {
      columns[field] = hits[0]
      continue
    }
    unresolved.push({
      field,
      required: !isOptionalField(field),
      reason: hits.length === 0 ? 'absent' : 'ambiguous',
      hits: hits.length,
    })
  }

  return { columns, unresolved }
}

function problemFor({ field, reason, hits }: UnresolvedFieldT): string {
  return reason === 'absent'
    ? `Nie znaleziono kolumny „${FIELD_LABELS[field]}".`
    : `Kolumna „${FIELD_LABELS[field]}" pasuje do ${hits} kolumn — zmień nazwę dodatkowej.`
}

function findCandidates(
  block: unknown[][],
  taken: ReadonlySet<number>,
  width: number,
): CandidateColumnT[] {
  const candidates: CandidateColumnT[] = []

  for (let column = 0; column < width; column += 1) {
    if (taken.has(column)) continue

    const labels: string[] = []
    for (const row of block) {
      const label = String(row[column] ?? '').trim()
      if (label && !labels.includes(label)) labels.push(label)
    }
    if (labels.length === 0) continue

    candidates.push({ column, letter: columnLetter(column), labels })
  }

  return candidates
}

const LABOR_FIELDS = [
  'plannedQty',
  'measuredQty',
  'unit',
  'clientPrice',
  'discount',
  'netValue',
  'comment',
] as const

export function resolveLaborColumns(
  grid: unknown[][],
  mapping: SheetColumnMappingT = {},
): ResolvedLaborColumnsT | LaborColumnsFailureT {
  const block = grid.slice(0, HEADER_BLOCK_ROWS)
  const { columns, unresolved } = resolveFields(block, LABOR_FIELDS)
  const problems: string[] = []

  const stages = findStages(block)
  if (!stages) {
    problems.push(`Nie znaleziono etapów — brak wiersza z oznaczeniem „${STAGE_MARKER}".`)
  }

  // „Nazwa sekcji" and „opis pracy" carry no header label of their own — row 1 of those columns
  // holds the client's address.
  const description = stages ? stages.firstColumn - 1 : -1
  const section = stages && stages.firstColumn >= 3 ? stages.firstColumn - 3 : -1
  if (stages && description < 0) {
    problems.push('Brak kolumny z opisem pracy przed kolumnami etapów.')
  }

  const taken = new Set<number>(Object.values(columns))
  if (stages) {
    for (let offset = 0; offset < stages.count; offset += 1) taken.add(stages.firstColumn + offset)
  }
  const ordinal = stages ? stages.firstColumn - 2 : -1
  for (const column of [description, ordinal, section]) if (column >= 0) taken.add(column)

  // The stored pointing runs LAST and only over what the header text left unresolved, so a corrected
  // header in the sheet always beats it.
  const blockWidth = Math.max(0, ...block.map((row) => row.length))
  const pointedFields: ColumnFieldT[] = []
  const missingFields: MissingFieldT[] = []

  for (const entry of unresolved) {
    const column = mapping[entry.field]
    if (column !== undefined && column < blockWidth && !taken.has(column)) {
      columns[entry.field] = column
      taken.add(column)
      pointedFields.push(entry.field)
      continue
    }
    missingFields.push({ field: entry.field, required: entry.required, reason: entry.reason })
    if (entry.required) problems.push(problemFor(entry))
  }

  // After the pointing, so a Przedmiar the owner pointed at bounds the run like a recognised one.
  const extendedStages = stages && extendToPrzedmiar(stages, columns)
  if (stages && extendedStages) {
    for (let offset = stages.count; offset < extendedStages.count; offset += 1) {
      taken.add(stages.firstColumn + offset)
    }
  }

  const candidates = findCandidates(block, taken, blockWidth)

  const { plannedQty, unit, clientPrice, netValue } = columns
  if (
    problems.length > 0 ||
    !extendedStages ||
    plannedQty === undefined ||
    unit === undefined ||
    clientPrice === undefined ||
    netValue === undefined
  ) {
    return { ok: false, problems, missingFields, candidates, pointedFields }
  }

  return {
    ok: true,
    columns: {
      ...(section >= 0 && { section }),
      description,
      ...columns,
      plannedQty,
      unit,
      clientPrice,
      netValue,
    },
    stages: extendedStages,
    missingFields,
    candidates,
    pointedFields,
  }
}

// The per-unit price column inside a rate group: the banner spans two columns (cena + wartość
// suma) and the last header row tells them apart — while the sub-label is always on the last row,
// which is what keeps the banner scan from swallowing „cena j.m." itself.
function findRateColumn(block: unknown[][], group: RateGroupT): number | null {
  const subLabels = block[HEADER_BLOCK_ROWS - 1] ?? []

  const inGroup = new Set<number>()
  for (const row of block.slice(0, HEADER_BLOCK_ROWS - 1)) {
    row.forEach((cell, column) => {
      if (RATE_GROUP_MATCHERS[group](fold(cell))) inGroup.add(column)
    })
  }

  const priced = [...inGroup].filter((column) => RATE_UNIT_PRICE_MATCHER(fold(subLabels[column])))
  return priced.length === 1 ? priced[0] : null
}

export function resolveRates(grid: unknown[][]): ResolvedRatesT | ResolveFailureT {
  const block = grid.slice(0, HEADER_BLOCK_ROWS)
  const problems: string[] = []

  const stages = findStages(block)
  if (!stages) {
    problems.push(`Nie znaleziono etapów — brak wiersza z oznaczeniem „${STAGE_MARKER}".`)
  }

  const wToolsRate = findRateColumn(block, 'wToolsRate')
  const ownToolsRate = findRateColumn(block, 'ownToolsRate')
  for (const [group, column] of [
    ['wToolsRate', wToolsRate],
    ['ownToolsRate', ownToolsRate],
  ] as const) {
    if (column === null) {
      problems.push(`Nie znaleziono kolumny „cena j.m." w grupie „${RATE_GROUP_LABELS[group]}".`)
    }
  }

  if (problems.length > 0 || !stages || wToolsRate === null || ownToolsRate === null) {
    return { ok: false, problems }
  }

  return {
    ok: true,
    columns: { description: stages.firstColumn - 1, wToolsRate, ownToolsRate },
  }
}
