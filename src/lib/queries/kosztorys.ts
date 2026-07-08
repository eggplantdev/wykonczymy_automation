import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import type {
  CostVariantT,
  DiscountTypeT,
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysTreeT,
  SubcontractorOverrideTypeT,
} from '@/types/kosztorys'

// Relationships arrive as a number (depth 0) or an object — we normalize to the id.
const relId = (v: unknown): number =>
  typeof v === 'object' && v ? (v as { id: number }).id : Number(v)
const num = (v: unknown): number => Number(v ?? 0)

// S-01: sections + items of a single investment, ordered by displayOrder → displayOrder.
// Stages (S-04) and VAT (S-12) are out of scope: stages/progress = [], vatRate = 0.
export async function getKosztorysTree(investmentId: number): Promise<KosztorysTreeT> {
  const payload = await getPayload({ config })
  const where = { investment: { equals: investmentId } }

  const [sectionsRes, itemsRes, investment] = await Promise.all([
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
    payload.findByID({ collection: 'investments', id: investmentId, depth: 0 }),
  ])

  const globalCoeffs = {
    wTools: num(investment.wToolsCoeff) || 0.65,
    ownTools: num(investment.ownToolsCoeff) || 0.55,
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

  const sections = sectionsRes.docs.map((d): KosztorysSectionT & { items: KosztorysItemT[] } => ({
    id: d.id,
    name: d.name,
    displayOrder: num(d.displayOrder),
    defaultCostVariant: (d.defaultCostVariant as CostVariantT) ?? 'w_tools',
    wToolsCoeff: d.wToolsCoeff == null ? null : num(d.wToolsCoeff),
    ownToolsCoeff: d.ownToolsCoeff == null ? null : num(d.ownToolsCoeff),
    items: items.filter((it) => it.sectionId === d.id),
  }))

  return { sections, stages: [], progress: [], globalCoeffs, vatRate: 0 }
}
