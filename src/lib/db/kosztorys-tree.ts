import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import { isSectionColorKey } from '@/lib/kosztorys/section-colors'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { isReviewStatus } from '@/lib/kosztorys/review-status'
import type {
  DiscountTypeT,
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
  StageSplitT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'
import { normalizeStageSplit } from '@/lib/kosztorys/stage-split'
import { withCatalogueFields, type ItemFieldsT } from '@/lib/kosztorys/item-from-fields'
import { toDescriptionTranslations } from '@/lib/i18n/description-translations'
import type { DbExecutorT } from './get-db'
import { numOrNull, textOrNull } from './row-coerce'

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
          SELECT ki.id, ki.section_id, ki.display_order, ki.description, ki.description_translations,
                 ki.unit, ki.planned_qty, ki.current_planned_qty, ki.sheet_measured_qty,
                 ki.discount_type, ki.discount_value, ki.client_price,
                 ki.w_tools_override_value, ki.own_tools_override_value,
                 ki.w_tools_override_coeff, ki.own_tools_override_coeff,
                 ki.note, ki.ref, ki.catalogue_item_id, ki.ai_planned_qty, ki.change_reason,
                 ki.review_status,
                 w.id AS catalogue_entry_id, w.description AS catalogue_description,
                 w.description_translations AS catalogue_description_translations,
                 w.unit AS catalogue_unit, w.client_price AS catalogue_client_price,
                 w.w_tools_rate AS catalogue_w_tools_rate,
                 w.w_tools_rate_coeff AS catalogue_w_tools_rate_coeff,
                 w.own_tools_rate AS catalogue_own_tools_rate,
                 w.own_tools_rate_coeff AS catalogue_own_tools_rate_coeff
          FROM kosztorys_items ki
          JOIN investments host ON host.id = ki.investment_id
          -- Only a szablon reads its prace from the katalog (EX-1017); a kosztorys keeps its own copy
          -- even where it remembers the entry.
          LEFT JOIN work_catalogue_items w
            ON w.id = ki.catalogue_item_id AND host.status = 'szablon'
          WHERE ki.investment_id = ${investmentId}
        ) i
      ) AS items,
      (
        SELECT coalesce(json_agg(st ORDER BY st.ordinal, st.id), '[]'::json)
        FROM (
          SELECT id, ordinal, label, plane, split_mode
          FROM kosztorys_stages WHERE investment_id = ${investmentId}
        ) st
      ) AS stages,
      -- Flat beside the etapy rather than nested in them, so each subselect stays one plain SELECT
      -- the SQL-drift spec can read.
      (
        SELECT coalesce(json_agg(m ORDER BY m.stage_id, m.id), '[]'::json)
        FROM (
          SELECT ksw.id, ksw.stage_id, ksw.worker_id, ksw.value, ksw.takes_rest
          FROM kosztorys_stage_workers ksw
          JOIN kosztorys_stages ks ON ks.id = ksw.stage_id
          WHERE ks.investment_id = ${investmentId}
        ) m
      ) AS stage_members,
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

  const membersByStage = Map.groupBy(row.stage_members as RowT[], (member) =>
    Number(member.stage_id),
  )

  return {
    sections: (row.sections as RowT[]).map(mapSection),
    items: (row.items as RowT[]).map(mapItem),
    stages: (row.stages as RowT[]).map((stage) =>
      mapStage(stage, membersByStage.get(Number(stage.id)) ?? []),
    ),
    progress: (row.progress as RowT[]).map(mapProgress),
    investment: {
      wToolsCoeff: numOrNull(row.w_tools_coeff),
      ownToolsCoeff: numOrNull(row.own_tools_coeff),
      vatRate: numOrNull(row.vat_rate),
      settlementMode: String(row.settlement_mode) as SettlementModeT,
      materialsNetRate: numOrNull(row.materials_net_rate),
      globalDiscountType: textOrNull(row.global_discount_type),
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

const mapItem = (row: RowT): KosztorysItemT & { sectionId: number } =>
  withCatalogueFields(mapOwnItem(row), mapCatalogueFields(row))

const mapCatalogueFields = (row: RowT): ItemFieldsT | null =>
  row.catalogue_entry_id == null
    ? null
    : {
        description: String(row.catalogue_description),
        descriptionTranslations: toDescriptionTranslations(row.catalogue_description_translations),
        unit: String(row.catalogue_unit),
        clientPrice: num(row.catalogue_client_price),
        wToolsRate: numOrNull(row.catalogue_w_tools_rate),
        wToolsRateCoeff: numOrNull(row.catalogue_w_tools_rate_coeff),
        ownToolsRate: numOrNull(row.catalogue_own_tools_rate),
        ownToolsRateCoeff: numOrNull(row.catalogue_own_tools_rate_coeff),
      }

const mapOwnItem = (row: RowT): KosztorysItemT & { sectionId: number } => ({
  id: Number(row.id),
  ref: Number(row.ref),
  sectionId: Number(row.section_id),
  displayOrder: num(row.display_order),
  description: textOrNull(row.description),
  descriptionTranslations: toDescriptionTranslations(row.description_translations),
  unit: textOrNull(row.unit),
  plannedQty: num(row.planned_qty),
  // `numOrNull`, not `num`: NULL follows Przedmiar ofertowy, while 0 dropped the pozycja from scope.
  currentPlannedQty: numOrNull(row.current_planned_qty),
  // `numOrNull`, not `num`: NULL means „the sheet made no claim" and must not collapse to a claim
  // of zero, which would flag every unmeasured row as diverged.
  sheetMeasuredQty: numOrNull(row.sheet_measured_qty),
  discountType: textOrNull(row.discount_type) as DiscountTypeT | null,
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
  note: textOrNull(row.note),
  catalogueItemId: numOrNull(row.catalogue_item_id),
  aiPlannedQty: numOrNull(row.ai_planned_qty),
  changeReason: textOrNull(row.change_reason),
  reviewStatus: isReviewStatus(row.review_status) ? row.review_status : null,
})

const mapStage = (row: RowT, members: RowT[]): KosztorysStageT => ({
  id: Number(row.id),
  ordinal: num(row.ordinal),
  label: textOrNull(row.label),
  plane: textOrNull(row.plane) as ToolPlaneT | null,
  split: mapStageSplit(row.split_mode, members),
})

// Shared by every raw read of an etap's members, so the tree, the pairs path and the worker view
// agree on what a stored split means.
export function mapStageSplit(mode: unknown, members: RowT[]): StageSplitT | null {
  return normalizeStageSplit({
    mode: mode === 'amount' ? 'amount' : 'percent',
    members: members.map((member) => ({
      workerId: Number(member.worker_id),
      value: num(member.value),
      takesRest: member.takes_rest === true,
    })),
  })
}

const mapProgress = (row: RowT): StageProgressT => ({
  itemId: Number(row.item_id),
  stageId: Number(row.stage_id),
  qtyDone: num(row.qty_done),
})
