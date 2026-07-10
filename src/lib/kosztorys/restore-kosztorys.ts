import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import type { SnapshotPayloadT } from './snapshot-format'

// Atomically revert an investment's whole kosztorys to a serialized snapshot: wipe the live tree,
// re-insert from the payload remapping child FKs to freshly-minted parent ids, then rewrite the
// three investment editor-settings. THE CALLER OWNS THE TRANSACTION — pass a `req` carrying a
// `transactionID` (and optional `context`, e.g. `skipRevalidation`); every op below threads it so a
// throw anywhere rolls the whole thing back and the live tree is never left half-wiped.
//
// Insert order is FK-safe: sections → items (need a section) → stages → progress (needs item+stage).
// Tolerant deserialization: only fields the current shape knows are read, missing arrays default to
// empty, and children whose parent is absent from the snapshot are skipped rather than orphaned — so
// a later additive migration doesn't break an older snapshot.
export async function restoreKosztorys(
  payload: Payload,
  req: PayloadRequest,
  investmentId: number,
  snapshot: SnapshotPayloadT,
): Promise<void> {
  const where = { investment: { equals: investmentId } }

  // Wipe. Deleting sections DB-cascades their items → stage_progress; deleting stages cascades any
  // remaining stage_progress. Order between the two is immaterial — cascades cover both directions.
  await payload.delete({ collection: 'kosztorys-sections', where, req })
  await payload.delete({ collection: 'kosztorys-stages', where, req })

  const sectionIdMap = new Map<number, number>()
  for (const section of snapshot.sections ?? []) {
    const created = await payload.create({
      collection: 'kosztorys-sections',
      req,
      data: {
        investment: investmentId,
        name: section.name,
        displayOrder: section.displayOrder,
        defaultCostVariant: section.defaultCostVariant,
        wToolsCoeff: section.wToolsCoeff,
        ownToolsCoeff: section.ownToolsCoeff,
      },
    })
    sectionIdMap.set(section.id, created.id)
  }

  const itemIdMap = new Map<number, number>()
  for (const item of snapshot.items ?? []) {
    const newSectionId = sectionIdMap.get(item.sectionId)
    if (!newSectionId) continue // parent section absent from the snapshot — skip the orphan
    const created = await payload.create({
      collection: 'kosztorys-items',
      req,
      data: {
        investment: investmentId,
        section: newSectionId,
        displayOrder: item.displayOrder,
        description: item.description,
        unit: item.unit,
        plannedQty: item.plannedQty,
        measuredQty: item.measuredQty,
        discountType: item.discountType,
        discountValue: item.discountValue,
        clientPrice: item.clientPrice,
        wToolsOverrideType: item.wToolsOverrideType,
        wToolsOverrideValue: item.wToolsOverrideValue,
        ownToolsOverrideType: item.ownToolsOverrideType,
        ownToolsOverrideValue: item.ownToolsOverrideValue,
        costVariant: item.costVariant,
        hiddenInExport: item.hiddenInExport,
        note: item.note,
      },
    })
    itemIdMap.set(item.id, created.id)
  }

  const stageIdMap = new Map<number, number>()
  for (const stage of snapshot.stages ?? []) {
    const created = await payload.create({
      collection: 'kosztorys-stages',
      req,
      data: { investment: investmentId, ordinal: stage.ordinal, label: stage.label },
    })
    stageIdMap.set(stage.id, created.id)
  }

  for (const entry of snapshot.progress ?? []) {
    const newItemId = itemIdMap.get(entry.itemId)
    const newStageId = stageIdMap.get(entry.stageId)
    if (!newItemId || !newStageId) continue // item or stage absent — skip the dangling progress row
    await payload.create({
      collection: 'stage-progress',
      req,
      data: { item: newItemId, stage: newStageId, qtyDone: entry.qtyDone },
    })
  }

  await payload.update({
    collection: 'investments',
    id: investmentId,
    req,
    data: {
      wToolsCoeff: snapshot.settings.wToolsCoeff,
      ownToolsCoeff: snapshot.settings.ownToolsCoeff,
      vatRate: snapshot.settings.vatRate,
    },
  })
}
