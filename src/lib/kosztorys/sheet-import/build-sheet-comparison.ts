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

export type ExecutedDiffT = ComparedItemT & {
  sheetNet: number
  appNet: number
  sheetQty: number
  appQty: number
  cell: string
}

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
  footer: FooterComparisonT[]
  counts: { sheetItems: number; appItems: number; matched: number }
  onlyInSheet: ComparedItemT[]
  onlyInApp: ComparedItemT[]
  executedDiffs: ExecutedDiffT[]
  rates: {
    decisions: ReportedRateResolutionT[] | null
    stale: StaleRateT[]
    warnings: string[]
  }
  referenceQty: { matched: number; withValue: number }
  globalDiscountMismatch: boolean
  health: FormulaHealthT
  sheetLink: { spreadsheetId: string; gid: number } | null
}

export type SheetComparisonResultT =
  | { ok: true; comparison: SheetComparisonT }
  | { ok: false; problems: string[] }

// Neither plane's coefficient can reach a client-plane figure, and no snapshot carries a global
// discount, so the client price is fully determined by the item itself.
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
 * Resolves the cenniki too, but never refuses over them: an unreadable „zakres pracy" header is the
 * state the import rejects outright, and it is exactly the sheet somebody opens this dialog to
 * diagnose.
 */
export function buildSheetComparison(
  grids: ImportGridsT,
  currentTree: SnapshotPayloadT,
  spreadsheetId: string,
  globalDiscount: GlobalDiscountT,
  mapping?: SheetColumnMappingT,
): SheetComparisonResultT {
  const resolved = resolveLaborColumns(grids.laborGrid, mapping)
  if (!resolved.ok) return { ok: false, problems: resolved.problems }

  const parsed = parseLaborTab(grids.laborGrid, resolved, grids.laborGridFormulas)

  const sheetSectionName = new Map(parsed.sections.map((section) => [section.id, section.name]))
  const appSectionName = new Map(currentTree.sections.map((section) => [section.id, section.name]))

  const sheetByKey = keyItems(
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
