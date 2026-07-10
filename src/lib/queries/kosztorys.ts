import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { DEFAULT_COEFFS, DEFAULT_VAT } from '@/lib/kosztorys/constants'
import type {
  CostVariantT,
  DiscountTypeT,
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  KosztorysTreeT,
  StageProgressT,
  SubcontractorOverrideTypeT,
} from '@/types/kosztorys'

// Relationships arrive as a number (depth 0) or an object — we normalize to the id.
const relId = (v: unknown): number =>
  typeof v === 'object' && v ? (v as { id: number }).id : Number(v)
const num = (v: unknown): number => Number(v ?? 0)

// S-01: sections + items of a single investment, ordered by displayOrder → displayOrder.
// S-04: stages (ordered by ordinal) + sparse per-item progress. S-05: per-investment VAT rate.
export async function getKosztorysTree(investmentId: number): Promise<KosztorysTreeT> {
  const payload = await getPayload({ config })
  const where = { investment: { equals: investmentId } }

  const [sectionsRes, itemsRes, stagesRes, progressRes, investment] = await Promise.all([
    payload.find({
      collection: 'kosztorys-sections',
      where,
      depth: 0,
      limit: 1000,
      sort: 'displayOrder',
    }),
    payload.find({
      collection: 'kosztorys-items',
      where,
      depth: 0,
      limit: 5000,
      sort: 'displayOrder',
    }),
    payload.find({
      collection: 'kosztorys-stages',
      where,
      depth: 0,
      limit: 1000,
      sort: 'ordinal',
    }),
    // Progress is filtered by the item's investment (stage-progress has no direct investment
    // column); depth 0 keeps item/stage as ids.
    payload.find({
      collection: 'stage-progress',
      where: { 'item.investment': { equals: investmentId } },
      depth: 0,
      limit: 100000,
    }),
    payload.findByID({ collection: 'investments', id: investmentId, depth: 0 }),
  ])

  // Distinguish an unset coefficient from a legitimate 0 — `|| default` would rewrite a stored 0.
  const globalCoeffs = {
    wTools: investment.wToolsCoeff == null ? DEFAULT_COEFFS.wTools : num(investment.wToolsCoeff),
    ownTools:
      investment.ownToolsCoeff == null ? DEFAULT_COEFFS.ownTools : num(investment.ownToolsCoeff),
  }

  const items: KosztorysItemT[] = itemsRes.docs.map((d) => ({
    id: d.id,
    sectionId: relId(d.section),
    displayOrder: num(d.displayOrder),
    description: d.description ?? null,
    unit: d.unit ?? null,
    plannedQty: num(d.plannedQty),
    measuredQty: num(d.measuredQty),
    discountType: (d.discountType as DiscountTypeT | null) ?? null,
    discountValue: num(d.discountValue),
    clientPrice: num(d.clientPrice),
    wToolsOverrideType: (d.wToolsOverrideType as SubcontractorOverrideTypeT | null) ?? null,
    wToolsOverrideValue: num(d.wToolsOverrideValue),
    ownToolsOverrideType: (d.ownToolsOverrideType as SubcontractorOverrideTypeT | null) ?? null,
    ownToolsOverrideValue: num(d.ownToolsOverrideValue),
    costVariant: (d.costVariant as CostVariantT | null) ?? null,
    hiddenInExport: Boolean(d.hiddenInExport),
    note: d.note ?? null,
  }))

  // Bucket items by section in one O(items) pass — a per-section filter would be O(sections × items),
  // quadratic at the 1000+-row bar this editor targets.
  const itemsBySection = new Map<number, KosztorysItemT[]>()
  for (const it of items) {
    const bucket = itemsBySection.get(it.sectionId)
    if (bucket) bucket.push(it)
    else itemsBySection.set(it.sectionId, [it])
  }

  const sections = sectionsRes.docs.map((d): KosztorysSectionT & { items: KosztorysItemT[] } => ({
    id: d.id,
    name: d.name,
    displayOrder: num(d.displayOrder),
    defaultCostVariant: (d.defaultCostVariant as CostVariantT) ?? 'w_tools',
    wToolsCoeff: d.wToolsCoeff == null ? null : num(d.wToolsCoeff),
    ownToolsCoeff: d.ownToolsCoeff == null ? null : num(d.ownToolsCoeff),
    items: itemsBySection.get(d.id) ?? [],
  }))

  const stages: KosztorysStageT[] = stagesRes.docs.map((d) => ({
    id: d.id,
    ordinal: num(d.ordinal),
    label: d.label ?? null,
  }))

  const progress: StageProgressT[] = progressRes.docs.map((d) => ({
    itemId: relId(d.item),
    stageId: relId(d.stage),
    qtyDone: num(d.qtyDone),
  }))

  return { sections, stages, progress, globalCoeffs, vatRate: investment.vatRate ?? DEFAULT_VAT }
}
