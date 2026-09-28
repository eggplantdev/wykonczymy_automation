import {
  FIELD_LABELS,
  FIELD_MATCHERS,
  HEADER_BLOCK_ROWS,
  isOptionalField,
  RATE_GROUP_LABELS,
  RATE_GROUP_MATCHERS,
  RATE_UNIT_PRICE_MATCHER,
  STAGE_MARKER,
  fold,
  type ColumnFieldT,
  type RateGroupT,
} from './columns'
import type { SheetColumnMappingT } from './sheet-column-mapping'
import { columnLetter } from '@/lib/google/sheet-configs'

export type StageColumnsT = { firstColumn: number; count: number }

export type ResolveFailureT = { ok: false; problems: string[] }

// Why a column was dropped: it isn't in the header block at all, or its name matches more than one
// column and the resolver refuses to guess. Different sentences for the owner — one is „dopisz
// kolumnę", the other „zmień nazwę tej drugiej".
export type UnresolvedReasonT = 'absent' | 'ambiguous'

export type MissingFieldT = { field: ColumnFieldT; required: boolean; reason: UnresolvedReasonT }

// A header-block column no field claimed. Carries the letter and the header texts because the owner
// picks it in the sheet, not in our column indices — and row 1 and row 3 are two different hints
// (row 1 is sometimes the client's address, row 3 the actual name).
export type CandidateColumnT = { column: number; letter: string; labels: string[] }

// What the owner can point a field at, on a read that resolved and on one that refused alike — the
// window offers the same pick either way, so a shape that existed only on failure would have to be
// rebuilt for the successful read.
export type UnresolvedColumnsT = {
  // On a header that resolved these are the optional fields only — a missing required column refuses
  // the import outright. The resolved columns say nothing worth reading; each absence is data
  // silently missing from the kosztorys.
  missingFields: MissingFieldT[]
  candidates: CandidateColumnT[]
  // Fields whose column came from the owner's stored pointing. Only these carry „wskazałeś tę
  // kolumnę ręcznie" — a pointing the header text overruled, or one aimed at a column that no longer
  // exists, is not something the owner is being shown a way to undo.
  pointedFields: ColumnFieldT[]
}

// Only the robocizna header carries the trio: it is the one the owner can repair by pointing at a
// column, so hanging it on the shared failure type would put three permanently empty arrays on every
// rates failure.
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

// No `stages` here on purpose. A rates tab carries its own „wykonano" run and it can be SHORTER
// than the kosztorys' — Białostocka's „z narzędziami" tab has 6 markers against 10 etapy. The run
// is read only to locate the description column beside it; the etap count comes from
// `kosztorys_robocizny` and nowhere else.
export type ResolvedRatesT = {
  ok: true
  columns: { description: number; wToolsRate: number; ownToolsRate: number }
}

// The columns matching one field. A field may be labelled on any row of the block, and the same
// field is often labelled on two rows with different wording — those agree on the column, so they
// are one hit, not two.
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

// The contiguous run of columns marked „wykonano" on row 2. Contiguous on purpose: a stray
// „wykonano" elsewhere in the row would otherwise stretch the range across unrelated columns.
function findStages(block: unknown[][]): StageColumnsT | null {
  const markerRow = block.find((row) => row.some((cell) => fold(cell) === STAGE_MARKER))
  if (!markerRow) return null

  const firstColumn = markerRow.findIndex((cell) => fold(cell) === STAGE_MARKER)
  let count = 0
  while (fold(markerRow[firstColumn + count]) === STAGE_MARKER) count += 1
  return { firstColumn, count }
}

// `hits` rides along only until the sentence is written — the count is what tells an ambiguous field
// „zmień nazwę tej drugiej" from a plain absence.
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

// A required field names itself so the owner knows which cell to fix, rather than getting a guess
// written into their kosztorys. An optional one gets no sentence at all: blocking the whole import
// over „rabat" would reject sheets that imported fine before the column existed — the report lists
// the absence instead.
function problemFor({ field, reason, hits }: UnresolvedFieldT): string {
  return reason === 'absent'
    ? `Nie znaleziono kolumny „${FIELD_LABELS[field]}".`
    : `Kolumna „${FIELD_LABELS[field]}" pasuje do ${hits} kolumn — zmień nazwę dodatkowej.`
}

// Every header-block column no field claimed and that isn't part of the etapy run — what the owner
// can be offered to pick from. A column with nothing typed in any block row is left out: it names
// nothing, so it could never be recognised in the sheet.
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
      // The same field is usually labelled on two rows with the same wording; one entry is enough.
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

// Resolve the `kosztorys_robocizny` header block. Total by design — an unresolvable header is a
// value the preview renders and a confirm button it disables, not an exception.
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
  // holds the client's address. They are the columns immediately left of the first etap: opis is
  // one back, then the ordinal, then the section name. A sheet with fewer leading columns has no
  // section column, and that is not a refusal: the parser names a section after its opis cell
  // when the section cell is empty — exactly what the owner got by inserting a blank column A.
  const description = stages ? stages.firstColumn - 1 : -1
  const section = stages && stages.firstColumn >= 3 ? stages.firstColumn - 3 : -1
  if (stages && description < 0) {
    problems.push('Brak kolumny z opisem pracy przed kolumnami etapów.')
  }

  const taken = new Set<number>(Object.values(columns))
  if (stages) {
    for (let offset = 0; offset < stages.count; offset += 1) taken.add(stages.firstColumn + offset)
  }
  // The ordinal between them is spoken for too — nothing reads it, but it is not free to point at.
  const ordinal = stages ? stages.firstColumn - 2 : -1
  for (const column of [description, ordinal, section]) if (column >= 0) taken.add(column)

  // The stored pointing runs LAST and only over what the header text left unresolved, so a corrected
  // header in the sheet always beats it. A column outside the block or already spoken for is skipped
  // in silence — that is a stale pointing, not a decision the owner is making right now.
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

  const candidates = findCandidates(block, taken, blockWidth)

  const { plannedQty, unit, clientPrice, netValue } = columns
  // The four required fields are re-checked here rather than asserted: `resolveFields` already
  // pushed a problem for each missing one, so this narrows the types on the same condition that
  // made `problems` non-empty.
  if (
    problems.length > 0 ||
    !stages ||
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
    stages,
    missingFields,
    candidates,
    pointedFields,
  }
}

// The per-unit price column inside a rate group: the banner spans two columns (cena + wartość
// suma) and the last header row tells them apart. The banner is looked for on any row but the last
// — sheets merge it across rows 1–2, others put it on one of them alone — while the sub-label is
// always on the last row, which is what keeps the banner scan from swallowing „cena j.m." itself.
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
