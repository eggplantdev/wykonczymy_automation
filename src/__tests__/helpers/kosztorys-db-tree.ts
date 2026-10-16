import type { Payload } from 'payload'
import type { KosztorysItem, KosztorysSection, KosztorysStage } from '@/payload-types'
import { getDb } from '@/lib/db/get-db'
import { insertStageMembers } from '@/lib/db/stage-split'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'
import type { StageSplitT } from '@/lib/kosztorys/types'

type SectionSpecT = Partial<
  Omit<KosztorysSection, 'id' | 'investment' | 'createdAt' | 'updatedAt'>
> & {
  name: string
  items?: ItemSpecT[]
}

type ItemSpecT = Partial<
  Omit<KosztorysItem, 'id' | 'investment' | 'section' | 'createdAt' | 'updatedAt'>
>

type StageSpecT = Partial<Omit<KosztorysStage, 'id' | 'investment' | 'createdAt' | 'updatedAt'>> & {
  worker?: number | null
  split?: StageSplitT | null
}

// Items and stages are addressed by position — `item` indexes the FLATTENED item list (declaration
// order across all sections), `stage` indexes `spec.stages`.
type ProgressSpecT = {
  item: number
  stage: number
  qtyDone: number
}

type TreeSpecT = {
  sections: SectionSpecT[]
  stages?: StageSpecT[]
  progress?: ProgressSpecT[]
}

type CreatedTreeT = {
  sectionIds: number[]
  itemIds: number[]
  stageIds: number[]
}

const FIXTURE_CONTEXT = { context: { skipRevalidation: true } } as const

export async function createKosztorysTree(
  payload: Payload,
  investmentId: number,
  spec: TreeSpecT,
): Promise<CreatedTreeT> {
  const sectionIds: number[] = []
  const itemIds: number[] = []
  const stageIds: number[] = []

  for (const [sectionIndex, section] of spec.sections.entries()) {
    const created = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: investmentId,
        name: section.name,
        // a spec that deliberately ties two sections on
        // display_order 0 must be able to say 0, and one that sets `color: null` must get null.
        displayOrder: section.displayOrder ?? sectionIndex,
        color: section.color ?? null,
      },
      ...FIXTURE_CONTEXT,
    })
    sectionIds.push(Number(created.id))

    for (const [itemIndex, item] of (section.items ?? []).entries()) {
      const createdItem = await payload.create({
        collection: 'kosztorys-items',
        data: {
          investment: investmentId,
          section: Number(created.id),
          displayOrder: item.displayOrder ?? itemIndex,
          description: item.description ?? null,
          descriptionTranslations: item.descriptionTranslations ?? {},
          unit: item.unit ?? null,
          plannedQty: item.plannedQty ?? 0,
          currentPlannedQty: item.currentPlannedQty ?? null,
          sheetMeasuredQty: item.sheetMeasuredQty ?? null,
          discountType: item.discountType ?? null,
          discountValue: item.discountValue ?? 0,
          clientPrice: item.clientPrice ?? 0,
          wToolsOverrideValue: item.wToolsOverrideValue ?? null,
          ownToolsOverrideValue: item.ownToolsOverrideValue ?? null,
          wToolsOverrideCoeff: item.wToolsOverrideCoeff ?? null,
          ownToolsOverrideCoeff: item.ownToolsOverrideCoeff ?? null,
          note: item.note ?? null,
          catalogueItemId: item.catalogueItemId ?? null,
          aiPlannedQty: item.aiPlannedQty ?? null,
          aiMissingData: item.aiMissingData ?? null,
          aiAssumptions: item.aiAssumptions ?? null,
          aiNewInformation: item.aiNewInformation ?? null,
          aiRecheck: item.aiRecheck ?? false,
          changeReason: item.changeReason ?? null,
          reviewStatus: item.reviewStatus ?? null,
        },
        ...FIXTURE_CONTEXT,
      })
      itemIds.push(Number(createdItem.id))
    }
  }

  for (const [stageIndex, stage] of (spec.stages ?? []).entries()) {
    const split = stage.split ?? (stage.worker != null ? oneWorkerSplit(stage.worker) : null)
    const created = await payload.create({
      collection: 'kosztorys-stages',
      data: {
        investment: investmentId,
        // 1-based: etapy are numbered from „Etap 1", and UNIQUE(investment_id, ordinal) means a
        // 0-based default would read wrong in every spec that spells an ordinal explicitly.
        ordinal: stage.ordinal ?? stageIndex + 1,
        label: stage.label ?? null,
        plane: stage.plane ?? null,
        splitMode: split?.mode ?? 'percent',
        completed: stage.completed ?? false,
      },
      ...FIXTURE_CONTEXT,
    })
    stageIds.push(Number(created.id))
    if (split)
      await insertStageMembers(await getDb(payload), [{ stageId: Number(created.id), split }])
  }

  for (const entry of spec.progress ?? []) {
    await payload.create({
      collection: 'stage-progress',
      data: {
        item: itemIds[entry.item],
        stage: stageIds[entry.stage],
        qtyDone: entry.qtyDone,
      },
      ...FIXTURE_CONTEXT,
    })
  }

  return { sectionIds, itemIds, stageIds }
}
