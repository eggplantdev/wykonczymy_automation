import { fold } from '@/lib/kosztorys/fold'
import { columnLetter } from '@/lib/google/sheet-configs'
import { HEADER_BLOCK_ROWS } from './columns'
import { NON_ITEM_MARKER } from './parse-labor-tab'
import type { ResolvedLaborColumnsT } from './resolve-columns'

export type FormulaSampleT = {
  row: number
  description: string
  cell: string
}

export type FormulaHealthT = {
  measuredCopiedFromPlanned: number
  plannedReadFromStage: number
  // #REF! / #DIV/0! arriving as strings from UNFORMATTED_VALUE and silently coerced to 0.
  errorValues: number
  samples: {
    plannedReadFromStage: FormulaSampleT[]
    errorValue: FormulaSampleT[]
  }
  totalRows: number
}

const SAMPLE_CAP = 50

const ERROR_VALUE = /^#(REF|DIV\/0|VALUE|NAME\?|N\/A|NUM|NULL)!?$/

const text = (cell: unknown): string =>
  typeof cell === 'string' ? cell.trim() : cell == null ? '' : String(cell).trim()

function ownRowReference(formula: unknown, rowNumber: number): string | null {
  if (typeof formula !== 'string' || !formula.startsWith('=')) return null
  const match = /^=\$?([A-Z]{1,2})\$?(\d+)$/.exec(formula.trim())
  if (!match || Number(match[2]) !== rowNumber) return null
  return match[1]
}

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
    if (fold(row[columns.plannedQty]) === NON_ITEM_MARKER || !description) continue
    health.totalRows++

    const rowNumber = rowIndex + 1
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
