import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { KosztorysSectionT } from '@/lib/kosztorys/types'

// A freshly created row, identified by id and where it landed in its parent's ordering.
export type NewRowT = { id: number; displayOrder: number }

// The append path needs the owner AND the slot to append at, and they share one section lookup.
//
// Append slot = MAX(display_order)+1, not COUNT: removeItemAction leaves gaps, so counting would
// collide with a surviving row after any middle delete.
export async function sectionOwnerAndNextItemOrder(
  db: DbExecutorT,
  sectionId: number,
): Promise<
  { investmentId: number; nextDisplayOrder: number; section: KosztorysSectionT } | undefined
> {
  const res = await db.execute(sql`
    SELECT
      s.investment_id AS investment, s.name, s.display_order, s.color,
      COALESCE(MAX(i.display_order) + 1, 0) AS next
    FROM kosztorys_sections s
    LEFT JOIN kosztorys_items i ON i.section_id = s.id
    WHERE s.id = ${sectionId}
    GROUP BY s.id, s.investment_id, s.name, s.display_order, s.color
  `)
  const row = res.rows[0]
  if (!row) return undefined
  return {
    investmentId: Number(row.investment),
    nextDisplayOrder: Number(row.next ?? 0),
    // Carried along because the batch-append path has to hand the grid a whole section slice, and
    // this lookup already has the row in hand.
    section: {
      id: sectionId,
      name: String(row.name),
      displayOrder: Number(row.display_order),
      color: (row.color as SectionColorKeyT | null) ?? null,
    },
  }
}
