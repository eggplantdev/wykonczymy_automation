import 'server-only'
import { getPayload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { getDb } from '@/lib/db/get-db'
import { selectKosztorysTreeData } from '@/lib/db/kosztorys-tree'
import { DEFAULT_COEFFS, DEFAULT_VAT } from '@/lib/kosztorys/constants'
import { perfStart } from '@/lib/perf'
import type { KosztorysItemT, KosztorysSectionT, KosztorysTreeT } from '@/lib/kosztorys/types'

// Deliberately not wrapped in React `cache()`: an action that reads, mutates and re-renders
// (`applyPercentRabatToAllItemsAction`) would get the pre-mutation tree back.
export async function getKosztorysTree(
  investmentId: number,
  req?: PayloadRequest,
): Promise<KosztorysTreeT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  return buildKosztorysTree(investmentId, req)
}

// `req` is the transaction-scoped one when a caller reads the tree it is about to replace: without
// it the read runs on its own connection, so it and the wipe describe two different instants even
// under one isolation level.
export async function buildKosztorysTree(
  investmentId: number,
  req?: PayloadRequest,
): Promise<KosztorysTreeT> {
  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const db = await getDb(payload, req)
  const setupMs = elapsed()

  const data = await selectKosztorysTreeData(db, investmentId)
  const queriesMs = elapsed()

  if (!data) throw new Error(`Investment ${investmentId} not found`)
  const { sections: sectionRows, items, stages, progress, investment } = data

  // Distinguish an unset coefficient from a legitimate 0 — `|| default` would rewrite a stored 0.
  const globalCoeffs = {
    wTools: investment.wToolsCoeff ?? DEFAULT_COEFFS.wTools,
    ownTools: investment.ownToolsCoeff ?? DEFAULT_COEFFS.ownTools,
  }

  const itemsBySection = new Map<number, KosztorysItemT[]>()
  for (const it of items) {
    const bucket = itemsBySection.get(it.sectionId)
    if (bucket) bucket.push(it)
    else itemsBySection.set(it.sectionId, [it])
  }

  const sections: (KosztorysSectionT & { items: KosztorysItemT[] })[] = sectionRows.map(
    (section) => ({ ...section, items: itemsBySection.get(section.id) ?? [] }),
  )

  const mapMs = elapsed()
  console.log(
    `[PERF] buildKosztorysTree ${setupMs + queriesMs + mapMs}ms ` +
      `(setup ${setupMs}ms, queries ${queriesMs}ms, map ${mapMs}ms) ` +
      `[inv ${investmentId}: ${sections.length} sections, ${items.length} items, ` +
      `${stages.length} stages, ${progress.length} progress]`,
  )

  return {
    sections,
    stages,
    progress,
    globalCoeffs,
    vatRate: investment.vatRate ?? DEFAULT_VAT,
    settlementMode: investment.settlementMode,
    materialsNetRate: investment.materialsNetRate ?? null,
    globalDiscount: {
      // Amount-only stored discount — fail closed on a legacy 'percent' row (treat it as none).
      type: investment.globalDiscountType === 'amount' ? 'amount' : null,
      value: investment.globalDiscountValue,
    },
    revision: investment.updatedAt,
  }
}
