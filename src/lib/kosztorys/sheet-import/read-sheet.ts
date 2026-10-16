import { fold } from '@/lib/kosztorys/fold'
import type { sheets_v4 } from 'googleapis'

export const LABOR_TAB = 'kosztorys_robocizny'
const RATE_TAB_PREFIX = 'zakres pracy'

const LAST_COLUMN = 'BZ'

export const LAST_COLUMN_INDEX =
  [...LAST_COLUMN].reduce((index, letter) => index * 26 + (letter.charCodeAt(0) - 64), 0) - 1

// Without this a hung Google request holds the server action open for the platform's whole function
// timeout
const SHEET_TIMEOUT = 15_000

export type RateTabGridT = {
  title: string
  grid: unknown[][]
  formulas: unknown[][]
}

export type ImportGridsT = {
  laborGrid: unknown[][]
  laborTabGid: number | undefined
  laborGridFormulas: unknown[][]
  rateTabs: RateTabGridT[]
}

export class MissingLaborTabError extends Error {
  constructor(spreadsheetId: string) {
    super(`Arkusz ${spreadsheetId} nie ma zakładki „${LABOR_TAB}".`)
  }
}

// Takes the client rather than building one so this module stays free of the `server-only` env
// layer — that guard makes anything importing it unusable from a `tsx` script
export async function readImportGrids(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<ImportGridsT> {
  // Tab titles have to be discovered rather than assumed: asking for a range on a tab that doesn't
  // exist fails the whole batch.
  const meta = await sheets.spreadsheets.get(
    {
      spreadsheetId,
      fields: 'sheets.properties(title,sheetId)',
    },
    { timeout: SHEET_TIMEOUT },
  )
  const properties = (meta.data.sheets ?? []).map((sheet) => sheet.properties)
  const titles = properties.map((props) => props?.title ?? '')

  const laborTabTitle = titles.find((title) => fold(title) === LABOR_TAB)
  if (!laborTabTitle) throw new MissingLaborTabError(spreadsheetId)

  const rateTitles = titles.filter((title) => fold(title).startsWith(RATE_TAB_PREFIX))
  const wanted = [laborTabTitle, ...rateTitles]

  const range = (title: string) => `'${title}'!A:${LAST_COLUMN}`
  const read = async (titles: string[], valueRenderOption: 'UNFORMATTED_VALUE' | 'FORMULA') => {
    const response = await sheets.spreadsheets.values.batchGet(
      {
        spreadsheetId,
        ranges: titles.map(range),
        valueRenderOption,
      },
      { timeout: SHEET_TIMEOUT },
    )
    return (response.data.valueRanges ?? []).map((values) => (values.values ?? []) as unknown[][])
  }

  const [grids, formulaGrids] = await Promise.all([
    // Numbers must arrive as numbers: formatted values come back as „1 234,56 zł" strings that a
    // locale-naive parseFloat reads as 1.
    read(wanted, 'UNFORMATTED_VALUE'),
    read(wanted, 'FORMULA'),
  ])

  return {
    laborGrid: grids[0] ?? [],
    laborTabGid: properties.find((props) => props?.title === laborTabTitle)?.sheetId ?? undefined,
    laborGridFormulas: formulaGrids[0] ?? [],
    rateTabs: rateTitles.map((title, index) => ({
      title,
      grid: grids[index + 1] ?? [],
      formulas: formulaGrids[index + 1] ?? [],
    })),
  }
}
