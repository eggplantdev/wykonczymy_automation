import { fold } from '@/lib/kosztorys/fold'
import { columnLetter } from '@/lib/google/sheet-configs'
import { HEADER_BLOCK_ROWS } from './columns'
import { NON_ITEM_MARKER } from './parse-labor-tab'
import type { ResolvedLaborColumnsT } from './resolve-columns'

export type FormulaSampleT = {
  row: number
  description: string
  // A1 reference of the cell to go and fix — the report links straight to it, because a row number
  // the owner retypes into the sheet is a row number they won't check.
  cell: string
}

export type FormulaHealthT = {
  // Pomiar copied from Przedmiar (`=N<own row>`): not a measurement, so no reference quantity is
  // stored — these rows are why zero rozjazdów proves nothing.
  // NOT a fault in the sheet (owner, 2026-08-15): older sheets were simply built this way, and on a
  // real one it is the majority of rows (241 of 336). Nobody is being asked to fix these.
  measuredCopiedFromPlanned: number
  // Przedmiar read from an etap column (`=M<own row>`): the offer becomes a derivative of execution,
  // and an empty etap makes it a zero offer.
  plannedReadFromStage: number
  // #REF! / #DIV/0! arriving as strings from UNFORMATTED_VALUE and silently coerced to 0. Counted
  // per row, like the two classes above, so the three numbers are read on one scale.
  errorValues: number
  // Per class, so the hundreds of rows one of them can carry never crowd out the handful in another.
  // `measuredCopiedFromPlanned` keeps no samples on purpose (owner, 2026-08-14): on a blank offer
  // sheet it is the NORMAL state of every row, so listing them invites a row-by-row hunt through
  // hundreds of prace that are not wrong. Its count answers the question by itself.
  samples: {
    plannedReadFromStage: FormulaSampleT[]
    errorValue: FormulaSampleT[]
  }
  totalRows: number
}

// Enough rows to recognise the class, not enough to bury the dialog.
const SAMPLE_CAP = 50

const ERROR_VALUE = /^#(REF|DIV\/0|VALUE|NAME\?|N\/A|NUM|NULL)!?$/

const text = (cell: unknown): string =>
  typeof cell === 'string' ? cell.trim() : cell == null ? '' : String(cell).trim()

/**
 * The column a formula copies wholesale from its OWN row, or null when it does anything else.
 * A bare `=N5` on row 5 is a column standing in for another; `=SUM(D5:M5)` and `=219,25+21,75` are
 * the owner doing real work and must not be reported — the whole point of the normalization written
 * down in `context/reference/kosztorys-sheet/formula-anomalies.md`.
 */
function ownRowReference(formula: unknown, rowNumber: number): string | null {
  if (typeof formula !== 'string' || !formula.startsWith('=')) return null
  const match = /^=\$?([A-Z]{1,2})\$?(\d+)$/.exec(formula.trim())
  if (!match || Number(match[2]) !== rowNumber) return null
  return match[1]
}

/**
 * Classify the formula grid the import already fetched. Report-only: nothing here changes what gets
 * imported — the parser's own refusals are unchanged, and this exists to say out loud which rows
 * those refusals silently swallowed.
 */
export function scanFormulaHealth(
  grid: unknown[][],
  formulas: unknown[][],
  resolved: ResolvedLaborColumnsT,
  footerStart: number,
): FormulaHealthT {
  const { columns, stages } = resolved
  const plannedLetter = columnLetter(columns.plannedQty)
  const stageLetters = new Set(
    Array.from({ length: stages.count }, (_, index) => columnLetter(stages.firstColumn + index)),
  )
  // Only the columns the app actually reads: an error parked in a column nobody imports changes no
  // figure, and reporting it would teach the owner to ignore the block.
  const readColumns = [
    columns.plannedQty,
    columns.measuredQty,
    columns.clientPrice,
    columns.discount,
    columns.netValue,
    ...Array.from({ length: stages.count }, (_, index) => stages.firstColumn + index),
  ].filter((column): column is number => column !== undefined)

  const health: FormulaHealthT = {
    measuredCopiedFromPlanned: 0,
    plannedReadFromStage: 0,
    errorValues: 0,
    samples: { plannedReadFromStage: [], errorValue: [] },
    totalRows: 0,
  }

  const lastRow = footerStart < 0 ? grid.length : footerStart

  for (let rowIndex = HEADER_BLOCK_ROWS; rowIndex < lastRow; rowIndex++) {
    const row = grid[rowIndex] ?? []
    const formulaRow = formulas[rowIndex] ?? []
    const description = text(row[columns.description])
    // Same two gates the parser uses to decide a row is a praca — a section header or a spacer has
    // formulas of its own that say nothing about the prace.
    if (fold(row[columns.plannedQty]) === NON_ITEM_MARKER || !description) continue
    health.totalRows++

    const rowNumber = rowIndex + 1
    // Capped: the count beside the fold carries the scale, so the rows are only there to show what
    // the class looks like. Uncapped, a 1000-row sheet whose every Pomiar is a formula — precisely
    // the shape this scanner exists to find — ships 1000 objects over the wire to render 1000 lines.
    const sample = (klass: keyof FormulaHealthT['samples'], column: number) => {
      if (health.samples[klass].length >= SAMPLE_CAP) return
      health.samples[klass].push({
        row: rowNumber,
        description,
        cell: `${columnLetter(column)}${rowNumber}`,
      })
    }

    if (
      columns.measuredQty !== undefined &&
      ownRowReference(formulaRow[columns.measuredQty], rowNumber) === plannedLetter
    ) {
      health.measuredCopiedFromPlanned++
    }

    const plannedSource = ownRowReference(formulaRow[columns.plannedQty], rowNumber)
    if (plannedSource !== null && stageLetters.has(plannedSource)) {
      health.plannedReadFromStage++
      sample('plannedReadFromStage', columns.plannedQty)
    }

    const erroring = readColumns.find((column) => ERROR_VALUE.test(text(row[column])))
    if (erroring !== undefined) {
      health.errorValues++
      sample('errorValue', erroring)
    }
  }

  return health
}
