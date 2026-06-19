import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import type {
  CostVariantT,
  DiscountTypeT,
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  KosztorysTreeT,
  StageProgressT,
} from '@/types/kosztorys'

// Relacje przychodzą jako number (depth 0) lub obiekt — normalizujemy do id.
const relId = (v: unknown): number =>
  typeof v === 'object' && v ? (v as { id: number }).id : Number(v)
const num = (v: unknown): number => Number(v ?? 0)

export async function getKosztorysTree(investmentId: number): Promise<KosztorysTreeT> {
  const payload = await getPayload({ config })
  const where = { investment: { equals: investmentId } }

  const [sectionsRes, itemsRes, stagesRes] = await Promise.all([
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
    payload.find({ collection: 'kosztorys-stages', where, depth: 0, limit: 1000, sort: 'ordinal' }),
  ])

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
    subcontractorWToolsPrice: num(d.subcontractorWToolsPrice),
    subcontractorOwnToolsPrice: num(d.subcontractorOwnToolsPrice),
    costVariant: (d.costVariant as CostVariantT | null) ?? null,
    vatRate: d.vatRate == null ? null : num(d.vatRate),
    hiddenInExport: Boolean(d.hiddenInExport),
    note: d.note ?? null,
  }))

  const sections = sectionsRes.docs.map((d): KosztorysSectionT & { items: KosztorysItemT[] } => ({
    id: d.id,
    name: d.name,
    displayOrder: num(d.displayOrder),
    vatRate: num(d.vatRate),
    defaultCostVariant: (d.defaultCostVariant as CostVariantT) ?? 'w_tools',
    items: items.filter((it) => it.sectionId === d.id),
  }))

  const stages: KosztorysStageT[] = stagesRes.docs.map((d) => ({
    id: d.id,
    ordinal: num(d.ordinal),
    label: d.label ?? null,
  }))

  // stage_progress nie ma kolumny investment — pobieramy po item id z tej inwestycji.
  const itemIds = items.map((it) => it.id)
  let progress: StageProgressT[] = []
  if (itemIds.length > 0) {
    const progressRes = await payload.find({
      collection: 'stage-progress',
      where: { item: { in: itemIds } },
      depth: 0,
      limit: 50000,
    })
    progress = progressRes.docs.map((d) => ({
      itemId: relId(d.item),
      stageId: relId(d.stage),
      qtyDone: num(d.qtyDone),
    }))
  }

  return { sections, stages, progress }
}
