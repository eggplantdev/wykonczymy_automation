import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'
import { FIELD_LABELS, isOptionalField, type ColumnFieldT, type OptionalFieldT } from './columns'
import type { SheetColumnMappingT } from './sheet-column-mapping'
import { deriveOverride } from './derive-override'
import { sheetCoeffs, type SheetCoeffsT } from './sheet-coeffs'
import { compareFooterTotals, type FooterComparisonT } from './footer-totals'
import { keyItems } from './item-key'
import { groupInOrder } from '@/lib/utils/group-in-order'
import { parseLaborTab } from './parse-labor-tab'
import { type ImportGridsT } from './read-sheet'
import {
  resolveLaborColumns,
  type MissingFieldT,
  type UnresolvedColumnsT,
  type UnresolvedReasonT,
} from './resolve-columns'
import {
  isReported,
  readRateTabs,
  resolveItemRates,
  type ReportedRateResolutionT,
} from './resolve-rates'

export type MissingColumnT = {
  field: ColumnFieldT
  label: string
  reason: UnresolvedReasonT
  consequence: string
}

// What the kosztorys loses when an optional column can't be read. The report names the loss, not the
// column: „nie znaleziono kolumny rabat" is a fact about the sheet, „każda praca wejdzie bez rabatu"
// is what the owner is actually deciding whether to accept.
const MISSING_COLUMN_CONSEQUENCES: Record<OptionalFieldT, string> = {
  discount: 'prace wejdą bez rabatu',
  measuredQty: 'nie będzie z czym porównać etapów przy „Porównaj z arkuszem"',
  comment: 'komentarze z arkusza nie wejdą',
}

// A praca the sheet does not have. `hasProgress` marks the ones where the loss is more than text —
// somebody typed wykonanie against them — so the preview can single those out before the write.
export type DroppedItemT = { section: string; description: string; hasProgress: boolean }

export type { ReportedRateResolutionT }

export type ImportReportT = {
  // Only the columns that did NOT come through — every required column is resolved or the import is
  // refused, so the recognised ones say nothing worth reading.
  missingColumns: MissingColumnT[]
  counts: { sections: number; items: number; stages: number }
  // Every decision that was NOT a plain agreement between the two price lists. Agreements are the
  // overwhelming majority and say nothing — listing them would bury the handful that need an eye.
  rateDecisions: ReportedRateResolutionT[]
  // The multipliers read out of the cennik's formulas, `null` where it stated none. Shown because
  // applying them overwrites a figure the owner may have set by hand in „Ustawienia".
  coeffs: SheetCoeffsT
  dropped: DroppedItemT[]
  totals: FooterComparisonT[]
  // Non-fatal notes, e.g. a „zakres pracy" tab whose own header could not be read: its rates are
  // simply unavailable, which is a degraded import rather than a refused one.
  warnings: string[]
}

export type ImportFailureT = { ok: false; problems: string[] } & UnresolvedColumnsT

export type ImportPlanT =
  | ({ ok: true; tree: SnapshotPayloadT; report: ImportReportT } & UnresolvedColumnsT)
  | ImportFailureT

/**
 * Everything the preview shows and everything apply writes, from the sheet grids plus the
 * investment's current tree. Both actions call this so the two can never disagree about what an
 * import would do — the same reason `buildSyncPlan` exists on the materials side.
 */
export function buildImportPlan(
  grids: ImportGridsT,
  currentTree: SnapshotPayloadT,
  mapping?: SheetColumnMappingT,
  // One rozliczenie for every imported etap, or null to leave them undecided. The sheet has no
  // column for it, so this is the owner's answer, given once in the import window — picking it per
  // etap afterwards is ten menus over etapy the grid keeps locked until they are set.
  plane: ToolPlaneT | null = null,
): ImportPlanT {
  const resolvedLaborColumns = resolveLaborColumns(grids.laborGrid, mapping)
  const { missingFields, candidates, pointedFields } = resolvedLaborColumns
  if (!resolvedLaborColumns.ok) {
    return {
      ok: false,
      problems: resolvedLaborColumns.problems,
      missingFields,
      candidates,
      pointedFields,
    }
  }

  // A resolved header can only be missing optional fields — a required one refuses the import above.
  const missingColumns: MissingColumnT[] = missingFields
    .filter((missing): missing is MissingFieldT & { field: OptionalFieldT } =>
      isOptionalField(missing.field),
    )
    .map(({ field, reason }) => ({
      field,
      label: FIELD_LABELS[field],
      reason,
      consequence: MISSING_COLUMN_CONSEQUENCES[field],
    }))

  const { tabs: rateTabs, warnings } = readRateTabs(grids.rateTabs)

  // With no cennik at all, `resolveItemRates` returns `missing` for every praca and `deriveOverride`
  // writes a flat 0 zł subcontractor cost onto each — a number that looks deliberate in the editor and
  // silently destroys the margin. A refusal the owner can act on („popraw nagłówki cennika") beats a
  // confirm button over 400 zeroes.
  if (rateTabs.length === 0) {
    return {
      ok: false,
      problems: [
        'Nie odczytałem żadnego cennika („zakres pracy") — wszystkie stawki podwykonawców trafiłyby do kosztorysu jako 0 zł.',
        ...warnings,
      ],
      missingFields,
      candidates,
      pointedFields,
    }
  }

  const parsed = parseLaborTab(grids.laborGrid, resolvedLaborColumns, grids.laborGridFormulas)
  const rates = resolveItemRates(
    parsed.items.map((item) => ({ description: item.description ?? '' })),
    rateTabs,
  )

  const missingRates = rates.filter((rate) => rate.kind === 'missing').length
  if (missingRates > 0) {
    warnings.push(`${missingRates} prac nie ma w żadnym cenniku — wejdą ze stawką 0 zł.`)
  }
  if (parsed.skippedBeforeFirstSection > 0) {
    warnings.push(
      `Pominięto ${parsed.skippedBeforeFirstSection} wierszy nad pierwszą sekcją — nie należą do żadnej sekcji.`,
    )
  }

  const sections: KosztorysSectionT[] = []
  const items: KosztorysItemT[] = []
  const progress: StageProgressT[] = []
  let nextSectionId = 1
  let nextItemId = 1

  const currentSectionName = new Map(
    currentTree.sections.map((section) => [section.id, section.name]),
  )
  const currentByKey = keyItems(
    currentTree.items,
    (item) => currentSectionName.get(item.sectionId) ?? '',
  )
  const matchedCurrentIds = new Set<number>()

  const parsedSectionName = new Map(parsed.sections.map((section) => [section.id, section.name]))
  const parsedKeys = keyItems(parsed.items, (item) => parsedSectionName.get(item.sectionId) ?? '')
  const keyByParsedId = new Map<number, string>()
  for (const [key, item] of parsedKeys) keyByParsedId.set(item.id, key)

  const rateByItemId = new Map(parsed.items.map((item, index) => [item.id, rates[index]]))

  // Read before the items are built: whether a praca enters as „auto" depends on the markup the
  // WHOLE cennik uses, which only exists once every row has been looked at.
  const coeffs = sheetCoeffs(
    parsed.items.map((item, index) => ({
      rate: rates[index]?.wToolsRate ?? 0,
      clientPrice: item.clientPrice,
      tracksClientPrice: rates[index]?.wToolsTracksPrice ?? false,
    })),
    parsed.items.map((item, index) => ({
      rate: rates[index]?.ownToolsRate ?? 0,
      clientPrice: item.clientPrice,
      tracksClientPrice: rates[index]?.ownToolsTracksPrice ?? false,
    })),
  )

  const parsedProgressByItem = groupInOrder(parsed.progress, (entry) => entry.itemId)
  const parsedItemsBySection = groupInOrder(parsed.items, (item) => item.sectionId)

  for (const sheetSection of parsed.sections) {
    const sectionId = nextSectionId++
    sections.push({ ...sheetSection, id: sectionId, displayOrder: sections.length })

    for (const sheetItem of parsedItemsBySection.get(sheetSection.id) ?? []) {
      const rate = rateByItemId.get(sheetItem.id)
      const current = currentByKey.get(keyByParsedId.get(sheetItem.id) ?? '')
      if (current) matchedCurrentIds.add(current.id)

      const wTools = deriveOverride(rate?.wToolsRate ?? 0, sheetItem.clientPrice, {
        tracksClientPrice: rate?.wToolsTracksPrice ?? false,
        planeCoeff: coeffs.wTools,
      })
      const ownTools = deriveOverride(rate?.ownToolsRate ?? 0, sheetItem.clientPrice, {
        tracksClientPrice: rate?.ownToolsTracksPrice ?? false,
        planeCoeff: coeffs.ownTools,
      })
      const itemId = nextItemId++
      items.push({
        ...sheetItem,
        id: itemId,
        sectionId,
        displayOrder: items.length,
        wToolsOverrideValue: wTools,
        ownToolsOverrideValue: ownTools,
        // The sheet has no column for it, so a matched praca keeps what the app holds rather
        // than having it blanked by an import that never had an opinion. `sheetMeasuredQty` gets
        // the opposite treatment on purpose — it rides the spread above and OVERWRITES, because it
        // is the sheet's own claim and the app never edits it: whatever the sheet says today is the
        // answer, including „nothing typed here any more".
        note: current?.note ?? null,
      })

      for (const entry of parsedProgressByItem.get(sheetItem.id) ?? []) {
        progress.push({ itemId, stageId: entry.stageId, qtyDone: entry.qtyDone })
      }
    }
  }

  const stages: KosztorysStageT[] = parsed.stages.map((stage) => ({ ...stage, plane }))

  // „Zastąp" means the sheet decides what the rozpiska contains: a praca it doesn't have stops
  // existing, rather than being appended beside the sheet's own copy. The owner is told what goes
  // before the write, and `replaceTreeWithSnapshot` takes a labelled snapshot either way.
  const progressByCurrentItem = groupInOrder(currentTree.progress, (entry) => entry.itemId)
  const dropped: DroppedItemT[] = currentTree.items
    .filter((item) => !matchedCurrentIds.has(item.id))
    .map((item) => ({
      section: currentSectionName.get(item.sectionId) ?? '',
      description: item.description ?? '',
      hasProgress: (progressByCurrentItem.get(item.id) ?? []).some((entry) => entry.qtyDone !== 0),
    }))

  return {
    ok: true,
    tree: {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      sections,
      items,
      stages,
      progress,
      // VAT has no cell in the sheet, and `restoreKosztorys` rewrites whatever it is handed — so the
      // investment's own must be carried through or an import silently resets it. The multipliers
      // the sheet DOES state (in its cennik formulas) are adopted; a cennik that states none leaves
      // the investment's alone.
      settings: {
        ...currentTree.settings,
        wToolsCoeff: coeffs.wTools ?? currentTree.settings.wToolsCoeff,
        ownToolsCoeff: coeffs.ownTools ?? currentTree.settings.ownToolsCoeff,
      },
    },
    missingFields,
    candidates,
    pointedFields,
    report: {
      missingColumns,
      counts: {
        sections: parsed.sections.length,
        items: parsed.items.length,
        stages: stages.length,
      },
      rateDecisions: rates.filter(isReported),
      coeffs,
      dropped,
      totals: compareFooterTotals(grids.laborGrid, resolvedLaborColumns, parsed),
      warnings,
    },
  }
}
