import type { Payload } from 'payload'
import type { KosztorysItem, KosztorysSection, KosztorysStage } from '@/payload-types'

// One declarative literal per tree, so a DB-gated spec states its fixture instead of assembling it —
// hand-built payload.create runs cost ~60 lines before a spec asserted anything and let each spec's
// column coverage drift on its own (EX-635).
//
// Sibling with a confusingly close name: helpers/kosztorys-tree.ts builds an in-memory KosztorysTreeT
// for the pure-calculation specs. This one writes rows. They share nothing but the domain noun.

// `investment` and `section` are the builder's job, and the timestamps are Payload's; everything else
// a spec may set. Sourced off the generated types so a new column can't silently become unreachable
// from the fixtures.
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
}

// Items and stages are addressed by position — `item` indexes the FLATTENED item list (declaration
// order across all sections), `stage` indexes `spec.stages`. Every call site wants "the first item",
// so a key registry would be ceremony for nobody; an index reads fine against the literal above it.
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

// `skipRevalidation` matters for the same reason it does in helpers/investment.ts: the specs run
// outside a request scope, where Payload's revalidation hooks throw.
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
        // `??`, not `||` or a spread of defaults: a spec that deliberately ties two sections on
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
          unit: item.unit ?? null,
          plannedQty: item.plannedQty ?? 0,
          sheetMeasuredQty: item.sheetMeasuredQty ?? null,
          discountType: item.discountType ?? null,
          discountValue: item.discountValue ?? 0,
          clientPrice: item.clientPrice ?? 0,
          wToolsOverrideValue: item.wToolsOverrideValue ?? null,
          ownToolsOverrideValue: item.ownToolsOverrideValue ?? null,
          wToolsOverrideCoeff: item.wToolsOverrideCoeff ?? null,
          ownToolsOverrideCoeff: item.ownToolsOverrideCoeff ?? null,
          note: item.note ?? null,
        },
        ...FIXTURE_CONTEXT,
      })
      itemIds.push(Number(createdItem.id))
    }
  }

  for (const [stageIndex, stage] of (spec.stages ?? []).entries()) {
    const created = await payload.create({
      collection: 'kosztorys-stages',
      data: {
        investment: investmentId,
        // 1-based: etapy are numbered from „Etap 1", and UNIQUE(investment_id, ordinal) means a
        // 0-based default would read wrong in every spec that spells an ordinal explicitly.
        ordinal: stage.ordinal ?? stageIndex + 1,
        label: stage.label ?? null,
        plane: stage.plane ?? null,
        worker: stage.worker ?? null,
      },
      ...FIXTURE_CONTEXT,
    })
    stageIds.push(Number(created.id))
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
