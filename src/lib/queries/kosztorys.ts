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

// S-01: sections + items of a single investment, ordered by displayOrder → displayOrder.
// S-04: stages (ordered by ordinal) + sparse per-item progress. S-05: per-investment VAT rate.
// Deliberately not wrapped in React `cache()`: an action that reads, mutates and re-renders
// (`applyPercentRabatToAllItemsAction`) would get the pre-mutation tree back. Rejected twice —
// context/archive/2026-07-27-decouple-panel-write-refresh/change.md, EX-850.
export async function getKosztorysTree(
  investmentId: number,
  req?: PayloadRequest,
): Promise<KosztorysTreeT> {
  // DAL guard: the read authorizes itself rather than trusting its caller. requireAuth's session
  // lookup is React-cache()'d, so a page that already guards pays for this only once.
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  return buildKosztorysTree(investmentId, req)
}

// The tree-building body, split from the guard above so the client-share read paths
// (lib/queries/preview-kosztorys.ts) — one of which is deliberately unauthenticated — reach the same
// tree through the same code. Two copies of this mapping would drift, and the client projection
// would then be projecting a different tree from the one the owner edits.
// `req` is the transaction-scoped one when a caller reads the tree it is about to replace: without
// it the read runs on its own connection, so it and the wipe describe two different instants even
// under one isolation level (EX-718). Every other caller reads live and passes nothing.
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

  // Bucket items by section in one O(items) pass — a per-section filter would be O(sections × items),
  // quadratic at the 1000+-row bar this editor targets.
  const itemsBySection = new Map<number, KosztorysItemT[]>()
  for (const it of items) {
    const bucket = itemsBySection.get(it.sectionId)
    if (bucket) bucket.push(it)
    else itemsBySection.set(it.sectionId, [it])
  }

  const sections: (KosztorysSectionT & { items: KosztorysItemT[] })[] = sectionRows.map(
    (section) => ({ ...section, items: itemsBySection.get(section.id) ?? [] }),
  )

  // Split from the query time because they answer different questions: a slow `queries` number argues
  // for caching or aggregating in SQL, a slow `map` number argues that materialising the tree in JS is
  // itself the cost — and only one of those is fixed by a cache.
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
