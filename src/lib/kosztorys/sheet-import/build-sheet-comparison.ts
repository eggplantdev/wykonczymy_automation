import { columnLetter } from '@/lib/google/sheet-configs'
import {
  MONEY_TOLERANCE,
  asViewPricing,
  globalDiscountAmount,
  isGlobalDiscountActive,
  netForQtyForView,
  rowPlannedNetForView,
  subcontractorPrice,
} from '@/lib/kosztorys/calc'
import type { SnapshotPayloadT, SnapshotSettingsT } from '@/lib/kosztorys/snapshot-format'
import type {
  GlobalDiscountT,
  KosztorysItemT,
  StageProgressT,
  ViewPricingT,
} from '@/lib/kosztorys/types'
import type { SheetColumnMappingT } from './sheet-column-mapping'
import { compareFooterTotals, type FooterComparisonT } from './footer-totals'
import { scanFormulaHealth, type FormulaHealthT } from './formula-health'
import { keyItems } from './item-key'
import { parseLaborTab, type ParsedItemT } from './parse-labor-tab'
import type { ImportGridsT } from './read-sheet'
import { resolveLaborColumns } from './resolve-columns'
import {
  isReported,
  readRateTabs,
  resolveItemRates,
  type RateResolutionT,
  type ReportedRateResolutionT,
} from './resolve-rates'

export type ComparedItemT = { section: string; description: string }

// One praca whose executed work is worth a different amount on each side — the whole difference in
// the money block, itemised, because a total nobody can trace back to a row is a total nobody acts on.
export type ExecutedDiffT = ComparedItemT & {
  sheetNet: number
  appNet: number
  sheetQty: number
  appQty: number
  // A1 reference of the praca's first etap cell, so the report links into the row that explains it.
  cell: string
}

// One praca whose subcontractor rate in the kosztorys is no longer what the sheet's cennik says.
// Both planes ride along even when only one moved: „55,25 / 45,00" against „60,00 / 45,00" is read
// as a pair, and the unchanged half is what makes the changed one legible.
export type StaleRateT = ComparedItemT & {
  sheetWTools: number
  appWTools: number
  sheetOwnTools: number
  appOwnTools: number
}

export type SheetComparisonT = {
  // Both sides' money, computed through `calc.ts` on each side rather than summed locally — a
  // reimplementation would agree with the parser's own mistakes.
  totals: {
    plannedNetFromSheet: number
    plannedNetFromApp: number
    executedNetFromSheet: number
    executedNetFromApp: number
  }
  // The sheet's own summary rows against what its own prace add up to — internal consistency, the
  // same check the import preview shows.
  footer: FooterComparisonT[]
  counts: { sheetItems: number; appItems: number; matched: number }
  onlyInSheet: ComparedItemT[]
  onlyInApp: ComparedItemT[]
  // Matched pozycje whose executed value differs, largest gap first.
  executedDiffs: ExecutedDiffT[]
  // The sheet's cenniki against the stawki the kosztorys holds. `decisions` is `null` when no cennik
  // could be read — the state the import refuses outright and this report survives, because a sheet
  // with a broken „zakres pracy" header is exactly the one somebody opens this dialog to diagnose.
  rates: {
    decisions: ReportedRateResolutionT[] | null
    stale: StaleRateT[]
    warnings: string[]
  }
  // How many matched pozycje would carry a reference quantity after a refresh — the denominator
  // behind „Rozjazd nic o nich nie powie".
  referenceQty: { matched: number; withValue: number }
  // True when a live global discount makes our column here disagree with the number the editor shows
  // for the same work — see `executedNetAsEditorShows`. The report does not change what it computes;
  // it says out loud that these amounts are read row by row and the editor's are not.
  globalDiscountMismatch: boolean
  health: FormulaHealthT
  // Everything a per-cell deep link needs, or null when the tab's gid didn't come back — the report
  // then prints the cell as text instead of a link that would open the wrong tab.
  sheetLink: { spreadsheetId: string; gid: number } | null
}

export type SheetComparisonResultT =
  | { ok: true; comparison: SheetComparisonT }
  | { ok: false; problems: string[] }

// Neither plane's coefficient can reach a client-plane figure, and no snapshot carries a global
// discount, so the client price is fully determined by the item itself. The parsed rows additionally
// lack both stawka fields — see `ParsedItemT` — which the client view never reads.
const asClientPricing = (item: ParsedItemT | KosztorysItemT): ViewPricingT => ({
  wToolsOverrideValue: null,
  ownToolsOverrideValue: null,
  wToolsOverrideCoeff: null,
  ownToolsOverrideCoeff: null,
  ...item,
  globalDiscountActive: false,
  globalWToolsCoeff: 0,
  globalOwnToolsCoeff: 0,
})

// The one place the investment's global coefficients matter: an item with no override inherits them,
// so a stawka read without them would look like a 0 zł crew cost on every such praca.
const asPlanePricing = (item: KosztorysItemT, settings: SnapshotSettingsT): ViewPricingT =>
  asViewPricing(item, { wTools: settings.wToolsCoeff, ownTools: settings.ownToolsCoeff })

function sumQtyDone(progress: readonly StageProgressT[]): Map<number, number> {
  const byItem = new Map<number, number>()
  for (const entry of progress) {
    byItem.set(entry.itemId, (byItem.get(entry.itemId) ?? 0) + entry.qtyDone)
  }
  return byItem
}

/**
 * The same executed work as the editor prices it: under a live global discount every row goes gross
 * (its own rabat bypassed) and the discount comes off once at the total. This report cannot do that —
 * it compares row against row, and a whole-kosztorys amount does not distribute onto rows honestly —
 * so the two figures legitimately part ways. Computed here only to know WHETHER they do.
 */
function executedNetAsEditorShows(
  items: readonly KosztorysItemT[],
  progress: readonly StageProgressT[],
  globalDiscount: GlobalDiscountT,
): number {
  const qtyDone = sumQtyDone(progress)
  let gross = 0
  for (const item of items) {
    const pricing = { ...asClientPricing(item), globalDiscountActive: true }
    gross += netForQtyForView(pricing, qtyDone.get(item.id) ?? 0, 'client')
  }
  return gross - globalDiscountAmount(gross, globalDiscount)
}

function planeTotals(
  items: readonly (ParsedItemT | KosztorysItemT)[],
  progress: readonly StageProgressT[],
): { plannedNet: number; executedNet: number } {
  const qtyDone = sumQtyDone(progress)
  let plannedNet = 0
  let executedNet = 0
  for (const item of items) {
    const pricing = asClientPricing(item)
    plannedNet += rowPlannedNetForView(pricing, 'client')
    executedNet += netForQtyForView(pricing, qtyDone.get(item.id) ?? 0, 'client')
  }
  return { plannedNet, executedNet }
}

/**
 * The both-sides reckoning behind „Porównaj z arkuszem": what each side says the work is worth,
 * which pozycje exist on one side only, and how much of the sheet the „Rozjazd" column is
 * structurally blind on.
 *
 * Resolves the cenniki too, but never refuses over them: an unreadable „zakres pracy" header is the
 * state the import rejects outright, and it is exactly the sheet somebody opens this dialog to
 * diagnose. Rates then come back as `null` — nothing to say — rather than as a wall of 0 zł.
 */
export function buildSheetComparison(
  grids: ImportGridsT,
  currentTree: SnapshotPayloadT,
  spreadsheetId: string,
  // Not on the tree: `SnapshotSettingsT` leaves the global discount out on purpose, so a restore
  // cannot reset the live amount. It arrives from the action, which knows the investment anyway.
  globalDiscount: GlobalDiscountT,
  mapping?: SheetColumnMappingT,
): SheetComparisonResultT {
  const resolved = resolveLaborColumns(grids.laborGrid, mapping)
  if (!resolved.ok) return { ok: false, problems: resolved.problems }

  const parsed = parseLaborTab(grids.laborGrid, resolved, grids.laborGridFormulas)

  const sheetSectionName = new Map(parsed.sections.map((section) => [section.id, section.name]))
  const appSectionName = new Map(currentTree.sections.map((section) => [section.id, section.name]))

  const sheetByKey = keyItems(
    // `keyItems` wants full items; the parsed ones lack both stawka fields, which it never
    // reads. Only the section, description and their order matter for keying.
    parsed.items as unknown as KosztorysItemT[],
    (item) => sheetSectionName.get(item.sectionId) ?? '',
  )
  const appByKey = keyItems(currentTree.items, (item) => appSectionName.get(item.sectionId) ?? '')

  const named = (item: KosztorysItemT, sectionName: Map<number, string>): ComparedItemT => ({
    section: sectionName.get(item.sectionId) ?? '',
    description: item.description ?? '',
  })

  const { tabs: rateTabs, warnings: rateWarnings } = readRateTabs(grids.rateTabs)
  const rateResolutions: RateResolutionT[] =
    rateTabs.length === 0
      ? []
      : resolveItemRates(
          parsed.items.map((item) => ({ description: item.description ?? '' })),
          rateTabs,
        )
  const rateByItemId = new Map(parsed.items.map((item, index) => [item.id, rateResolutions[index]]))

  const onlyInSheet: ComparedItemT[] = []
  const onlyInApp: ComparedItemT[] = []
  const executedDiffs: ExecutedDiffT[] = []
  const staleRates: StaleRateT[] = []
  let matched = 0
  let withValue = 0

  const sheetQtyDone = sumQtyDone(parsed.progress)
  const appQtyDone = sumQtyDone(currentTree.progress)
  const stageLetter = columnLetter(resolved.stages.firstColumn)

  for (const [key, item] of sheetByKey) {
    const appItem = appByKey.get(key)
    if (appItem === undefined) {
      onlyInSheet.push(named(item, sheetSectionName))
      continue
    }
    matched++
    // The sheet's claim as the parser would import it — a formula or an empty cell is no claim, and
    // those rows are precisely the ones „Rozjazd" cannot speak about.
    if (item.sheetMeasuredQty !== null) withValue++

    const sheetQty = sheetQtyDone.get(item.id) ?? 0
    const appQty = appQtyDone.get(appItem.id) ?? 0
    const sheetNet = netForQtyForView(asClientPricing(item), sheetQty, 'client')
    const appNet = netForQtyForView(asClientPricing(appItem), appQty, 'client')
    if (Math.abs(sheetNet - appNet) >= MONEY_TOLERANCE) {
      executedDiffs.push({
        ...named(item, sheetSectionName),
        sheetNet,
        appNet,
        sheetQty,
        appQty,
        cell: `${stageLetter}${parsed.sheetRowByItemId.get(item.id) ?? 0}`,
      })
    }

    // A praca the cennik no longer lists is skipped rather than reported as „stawka 0 zł" — that is
    // a fact about the cennik, and the import already refuses to guess on it. A praca whose cenniki
    // disagree is skipped for the same reason: „the sheet says X" is exactly what is not true there,
    // so every one of them would report a rozjazd against a figure the sheet never stated.
    const rate = rateByItemId.get(item.id)
    if (rate !== undefined && rate.kind !== 'missing' && rate.kind !== 'conflict') {
      const pricing = asPlanePricing(appItem, currentTree.settings)
      const appWTools = subcontractorPrice(pricing, 'w_tools')
      const appOwnTools = subcontractorPrice(pricing, 'own_tools')
      if (
        Math.abs(rate.wToolsRate - appWTools) >= MONEY_TOLERANCE ||
        Math.abs(rate.ownToolsRate - appOwnTools) >= MONEY_TOLERANCE
      ) {
        staleRates.push({
          ...named(item, sheetSectionName),
          sheetWTools: rate.wToolsRate,
          appWTools,
          sheetOwnTools: rate.ownToolsRate,
          appOwnTools,
        })
      }
    }
  }
  executedDiffs.sort(
    (left, right) =>
      Math.abs(right.sheetNet - right.appNet) - Math.abs(left.sheetNet - left.appNet),
  )
  for (const [key, item] of appByKey) {
    if (!sheetByKey.has(key)) onlyInApp.push(named(item, appSectionName))
  }

  const sheetTotals = planeTotals(parsed.items, parsed.progress)
  const appTotals = planeTotals(currentTree.items, currentTree.progress)

  return {
    ok: true,
    comparison: {
      totals: {
        plannedNetFromSheet: sheetTotals.plannedNet,
        plannedNetFromApp: appTotals.plannedNet,
        executedNetFromSheet: sheetTotals.executedNet,
        executedNetFromApp: appTotals.executedNet,
      },
      footer: compareFooterTotals(grids.laborGrid, resolved, parsed),
      counts: {
        sheetItems: parsed.items.length,
        appItems: currentTree.items.length,
        matched,
      },
      onlyInSheet,
      onlyInApp,
      executedDiffs,
      rates: {
        decisions: rateTabs.length === 0 ? null : rateResolutions.filter(isReported),
        stale: staleRates,
        warnings: rateWarnings,
      },
      referenceQty: { matched, withValue },
      globalDiscountMismatch:
        isGlobalDiscountActive(globalDiscount) &&
        Math.abs(
          executedNetAsEditorShows(currentTree.items, currentTree.progress, globalDiscount) -
            appTotals.executedNet,
        ) >= MONEY_TOLERANCE,
      health: scanFormulaHealth(
        grids.laborGrid,
        grids.laborGridFormulas,
        resolved,
        parsed.footerStart,
      ),
      sheetLink: grids.laborTabGid === undefined ? null : { spreadsheetId, gid: grids.laborTabGid },
    },
  }
}
