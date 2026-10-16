import { mergeTranslations } from '@/lib/i18n/description-translations'
import type { CatalogueIdentityT } from '@/lib/kosztorys/work-catalogue/types'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
} from '@/lib/kosztorys/types'
import { FIELD_LABELS, isOptionalField, type ColumnFieldT, type OptionalFieldT } from './columns'
import type { SheetColumnMappingT } from './sheet-column-mapping'
import { deriveOverride } from './derive-override'
import { sheetCoeffs, type SheetCoeffsT } from './sheet-coeffs'
import { compareFooterTotals, type FooterComparisonT } from './footer-totals'
import { keyItems } from './item-key'
import { groupInOrder } from '@/lib/utils/group-in-order'
import { aiDraftOf } from '@/lib/kosztorys/ai-draft'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'
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

const MISSING_COLUMN_CONSEQUENCES: Record<OptionalFieldT, string> = {
  discount: 'prace wejdą bez rabatu',
  measuredQty: 'nie będzie z czym porównać etapów przy „Porównaj z arkuszem"',
  comment: 'komentarze z arkusza nie wejdą',
}

export type DroppedItemT = { section: string; description: string; hasProgress: boolean }

export type { ReportedRateResolutionT }

export type ImportReportT = {
  missingColumns: MissingColumnT[]
  counts: { sections: number; items: number; stages: number }
  rateDecisions: ReportedRateResolutionT[]
  coeffs: SheetCoeffsT
  dropped: DroppedItemT[]
  totals: FooterComparisonT[]
  warnings: string[]
}

export type StageDefaultsT = Pick<KosztorysStageT, 'plane'> & { workerId: number | null }

export type ImportFailureT = { ok: false; problems: string[] } & UnresolvedColumnsT

export type ImportPlanT =
  | ({ ok: true; tree: SnapshotPayloadT; report: ImportReportT } & UnresolvedColumnsT)
  | ImportFailureT

export function buildImportPlan(
  grids: ImportGridsT,
  currentTree: SnapshotPayloadT,
  mapping?: SheetColumnMappingT,
  stageDefaults: StageDefaultsT = { plane: null, workerId: null },
  catalogue: ReadonlyMap<string, CatalogueIdentityT> = new Map(),
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
  // silently destroys the margin.
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
      const catalogueEntry = catalogue.get(
        catalogueKey(sheetItem.description ?? '', sheetItem.unit),
      )
      const itemId = nextItemId++
      items.push({
        ...sheetItem,
        id: itemId,
        sectionId,
        displayOrder: items.length,
        wToolsOverrideValue: wTools,
        ownToolsOverrideValue: ownTools,
        wToolsOverrideCoeff: null,
        ownToolsOverrideCoeff: null,
        // The sheet has no column for it, so a matched praca keeps what the app holds rather
        // than having it blanked by an import that never had an opinion.
        note: current?.note ?? null,
        // The sheet has one przedmiar, the offer — it refreshes plannedQty above and never the
        // Aktualizacja, so a hand-edited scope survives a re-import (EX-921).
        currentPlannedQty: current?.currentPlannedQty ?? null,
        ...aiDraftOf(current),
        changeReason: current?.changeReason ?? null,
        reviewStatus: current?.reviewStatus ?? null,
        // Carried on the same key as the note, so a form printed before the import still resolves
        // the pozycja it numbered; an unmatched row is new work and draws a fresh number.
        ref: current?.ref,
        catalogueItemId: current?.catalogueItemId ?? catalogueEntry?.id ?? null,
        descriptionTranslations: mergeTranslations(
          catalogueEntry?.descriptionTranslations,
          current?.descriptionTranslations,
          sheetItem.description ?? '',
        ),
      })

      for (const entry of parsedProgressByItem.get(sheetItem.id) ?? []) {
        progress.push({ itemId, stageId: entry.stageId, qtyDone: entry.qtyDone })
      }
    }
  }

  const stages: KosztorysStageT[] = parsed.stages.map((stage) => ({
    ...stage,
    plane: stageDefaults.plane,
    // A wykonawca on an etap with no rozliczenie would be named against a silent 0 zł należne.
    split:
      stageDefaults.plane && stageDefaults.workerId != null
        ? oneWorkerSplit(stageDefaults.workerId)
        : null,
  }))

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
      // investment's own must be carried through or an import silently resets it.
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
