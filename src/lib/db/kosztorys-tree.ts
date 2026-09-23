import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import { isSectionColorKey } from '@/lib/kosztorys/section-colors'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type {
  DiscountTypeT,
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'
import type { DbExecutorT } from './get-db'
import { numOrNull } from './row-coerce'

// Everything behind the editor tree in ONE round trip.
//
// The one round trip is NOT what makes this fast, and nothing new should be collapsed into a single
// query on that reasoning — EX-597 measured the parallel-reads version it replaced and the round-trip
// count was never the cost. Neon's latency is bimodal (~20–60 ms warm, ~160–200 ms cold), which is
// what makes a small sample look structural. Record:
// `context/archive/2026-07-27-decouple-panel-write-refresh/change.md` § Superseded beliefs.
//
// Each collection is aggregated server-side into a jsonb array, ordered inside the aggregate. Values
// arrive already typed by JSON (numeric renders as a JSON number), but `num` stays on every figure
// because a null column must read as 0, not NaN.

const num = (v: unknown): number => Number(v ?? 0)
const str = (v: unknown): string | null => (v == null ? null : String(v))

export type KosztorysTreeDataT = {
  sections: KosztorysSectionT[]
  items: (KosztorysItemT & { sectionId: number })[]
  stages: KosztorysStageT[]
  progress: StageProgressT[]
  investment: {
    wToolsCoeff: number | null
    ownToolsCoeff: number | null
    vatRate: number | null
    settlementMode: SettlementModeT
    materialsNetRate: number | null
    globalDiscountType: string | null
    globalDiscountValue: number
    updatedAt: string
  }
}

type RowT = Record<string, unknown>

// `coalesce(json_agg(...), '[]')` matters: json_agg over no rows is NULL, not an empty array, so an
// investment with no sections yet would otherwise arrive as null and crash the mapper.
export async function selectKosztorysTreeData(
  db: DbExecutorT,
  investmentId: number,
): Promise<KosztorysTreeDataT | null> {
  const res = await db.execute(sql`
    SELECT
      (
        SELECT coalesce(json_agg(s ORDER BY s.display_order, s.id), '[]'::json)
        FROM (
          SELECT id, name, display_order, color
          FROM kosztorys_sections WHERE investment_id = ${investmentId}
        ) s
      ) AS sections,
      (
        SELECT coalesce(json_agg(i ORDER BY i.display_order, i.id), '[]'::json)
        FROM (
          SELECT id, section_id, display_order, description, unit, planned_qty,
                 sheet_measured_qty,
                 discount_type, discount_value, client_price,
                 w_tools_override_value, own_tools_override_value,
                 w_tools_override_coeff, own_tools_override_coeff,
                 note
          FROM kosztorys_items WHERE investment_id = ${investmentId}
        ) i
      ) AS items,
      (
        SELECT coalesce(json_agg(st ORDER BY st.ordinal, st.id), '[]'::json)
        FROM (
          SELECT id, ordinal, label, plane, worker_id
          FROM kosztorys_stages WHERE investment_id = ${investmentId}
        ) st
      ) AS stages,
      -- stage_progress carries no investment column, so it reaches the investment through its item.
      (
        SELECT coalesce(json_agg(p ORDER BY p.item_id, p.stage_id), '[]'::json)
        FROM (
          SELECT sp.item_id, sp.stage_id, sp.qty_done
          FROM stage_progress sp
          JOIN kosztorys_items ki ON ki.id = sp.item_id
          WHERE ki.investment_id = ${investmentId}
        ) p
      ) AS progress,
      inv.w_tools_coeff, inv.own_tools_coeff, inv.vat_rate, inv.settlement_mode,
      inv.materials_net_rate, inv.global_discount_type, inv.global_discount_value, inv.updated_at
    FROM investments inv
    WHERE inv.id = ${investmentId}
  `)

  const row = res.rows[0]
  if (!row) return null

  return {
    sections: (row.sections as RowT[]).map(mapSection),
    items: (row.items as RowT[]).map(mapItem),
    stages: (row.stages as RowT[]).map(mapStage),
    progress: (row.progress as RowT[]).map(mapProgress),
    investment: {
      wToolsCoeff: numOrNull(row.w_tools_coeff),
      ownToolsCoeff: numOrNull(row.own_tools_coeff),
      vatRate: numOrNull(row.vat_rate),
      settlementMode: String(row.settlement_mode) as SettlementModeT,
      materialsNetRate: numOrNull(row.materials_net_rate),
      globalDiscountType: str(row.global_discount_type),
      globalDiscountValue: num(row.global_discount_value),
      // Payload handed callers an ISO string; the driver hands back a Date. The revision token is
      // compared by value in the editor shell, so the format has to stay stable.
      updatedAt: new Date(row.updated_at as string).toISOString(),
    },
  }
}

const mapSection = (row: RowT): KosztorysSectionT => ({
  id: Number(row.id),
  name: String(row.name ?? ''),
  displayOrder: num(row.display_order),
  // Validated on read, not trusted: a key retired from the palette reads as unpinned rather than
  // painting with a CSS var that no longer exists.
  color: isSectionColorKey(row.color) ? row.color : null,
})

const mapItem = (row: RowT): KosztorysItemT & { sectionId: number } => ({
  id: Number(row.id),
  sectionId: Number(row.section_id),
  displayOrder: num(row.display_order),
  description: str(row.description),
  unit: str(row.unit),
  plannedQty: num(row.planned_qty),
  // `numOrNull`, not `num`: NULL means „the sheet made no claim" and must not collapse to a claim
  // of zero, which would flag every unmeasured row as diverged.
  sheetMeasuredQty: numOrNull(row.sheet_measured_qty),
  discountType: str(row.discount_type) as DiscountTypeT | null,
  discountValue: num(row.discount_value),
  clientPrice: num(row.client_price),
  // `numOrNull`, not `num`: NULL is „auto", and folding it to 0 would price the praca at zero
  // złotych instead of at the investment's współczynnik (EX-766).
  wToolsOverrideValue: numOrNull(row.w_tools_override_value),
  ownToolsOverrideValue: numOrNull(row.own_tools_override_value),
  // Same reading of NULL one level over: absent means „no mnożnik here", while `0` is a mnożnik
  // someone chose — a stawka of zero złotych (EX-865).
  wToolsOverrideCoeff: numOrNull(row.w_tools_override_coeff),
  ownToolsOverrideCoeff: numOrNull(row.own_tools_override_coeff),
  note: str(row.note),
})

const mapStage = (row: RowT): KosztorysStageT => ({
  id: Number(row.id),
  ordinal: num(row.ordinal),
  label: str(row.label),
  plane: str(row.plane) as ToolPlaneT | null,
  workerId: numOrNull(row.worker_id),
})

const mapProgress = (row: RowT): StageProgressT => ({
  itemId: Number(row.item_id),
  stageId: Number(row.stage_id),
  qtyDone: num(row.qty_done),
})
