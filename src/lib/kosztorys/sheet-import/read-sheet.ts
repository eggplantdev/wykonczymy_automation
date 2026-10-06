import { fold } from '@/lib/kosztorys/fold'
import type { sheets_v4 } from 'googleapis'

export const LABOR_TAB = 'kosztorys_robocizny'
const RATE_TAB_PREFIX = 'zakres pracy'

// Wide enough for the widest layout seen (the wartość block ends at AF) with room to spare, and
// bounded so a sheet with junk far to the right doesn't inflate every response.
const LAST_COLUMN = 'BZ'

// The same bound as a 0-based index, for anything that has to reject a column we would never fetch.
export const LAST_COLUMN_INDEX =
  [...LAST_COLUMN].reduce((index, letter) => index * 26 + (letter.charCodeAt(0) - 64), 0) - 1

// Without this a hung Google request holds the server action open for the platform's whole function
// timeout, with both sheet dialogs stuck on „Czytam arkusz Google…" and no way to tell the owner
// anything. Failing at 15s at least reaches `sheetFailureMessage`, which says to retry.
const SHEET_TIMEOUT = 15_000

export type RateTabGridT = {
  title: string
  grid: unknown[][]
  // The same cells rendered as formulas. A rate the owner typed by hand comes back as the number
  // itself; one the sheet computed comes back as „=…". That difference is the only evidence of
  // which tab's price is a deliberate decision, and it decides which tab wins when they disagree.
  formulas: unknown[][]
}

export type ImportGridsT = {
  laborGrid: unknown[][]
  // The tab's numeric sheetId — the `#gid=` a link to a single cell needs. Comes free with the
  // metadata call the tab titles already require; `undefined` only if Google omits it, in which case
  // the report degrades to a plain row number rather than a dead link.
  laborTabGid: number | undefined
  // The robocizna tab rendered as formulas, aligned cell-for-cell with `laborGrid`. See the comment
  // at the fetch site for why a formula is load-bearing here and not just a cheaper render.
  laborGridFormulas: unknown[][]
  // Both „zakres pracy" tabs carry both price lists, so either one can supply the rates. They are
  // returned as a list rather than a z-narzędziami/bez-narzędzi pair because the tab TITLES are not
  // a reliable index — a tab titled „z narzędziami" holds the „bez narzędzi" columns too, and the
  // titles carry stray trailing spaces. Which column is which is the resolver's job, not the
  // title's.
  rateTabs: RateTabGridT[]
}

export class MissingLaborTabError extends Error {
  constructor(spreadsheetId: string) {
    super(`Arkusz ${spreadsheetId} nie ma zakładki „${LABOR_TAB}".`)
  }
}

// Takes the client rather than building one so this module stays free of the `server-only` env
// layer — that guard makes anything importing it unusable from a `tsx` script, and the smoke script
// that checks the resolver against live sheets has to run exactly this code, not a copy of it.
// The app's caller gets its client from `./sheets-client`.
export async function readImportGrids(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<ImportGridsT> {
  // Tab titles have to be discovered rather than assumed: the rate tabs are named „zakres pracy z
  // narzędziami   " on one sheet and „zakres pracy bez narzędzi" on the next, trailing spaces
  // included, and asking for a range on a tab that doesn't exist fails the whole batch.
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
    // Every tab is fetched twice, values and formulas, because on both a formula says where a
    // figure came from. On a rate tab it marks the price the owner did NOT type, which decides
    // which price list wins; on the robocizna tab it tells „Pomiar z natury" apart from the blank
    // sheet's own sum of the etapy — storing the latter would compare Σ etapów against itself.
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
