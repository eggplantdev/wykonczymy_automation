import { crewAxisShows, type CrewAxisT } from '@/lib/kosztorys/crew-axis'
import { WORKSHOP_VISIBLE_COLUMNS } from '@/lib/kosztorys/workshop-columns'
import {
  CLIENT_EMPTY_CONDITION_ID,
  HAS_PLANNED_OR_AI_QTY_CONDITION_ID,
  REPORT_UNREPORTED_CONDITION_ID,
  ROW_CONDITIONS,
} from '@/lib/kosztorys/row-conditions/registry'
import type {
  FilterConditionT,
  RowConditionCtxT,
  RowConditionKindT,
  RowConditionT,
} from '@/lib/kosztorys/row-conditions/types'
import type { KosztorysV2RowT, ToolPlaneT } from '@/lib/kosztorys/types'

const BY_ID = new Map(ROW_CONDITIONS.map((condition) => [condition.id, condition]))

export function applyRowConditions(
  rows: KosztorysV2RowT[],
  engagedIds: Iterable<string>,
  ctx: RowConditionCtxT,
  latchedRowIds?: ReadonlySet<number>,
): KosztorysV2RowT[] {
  const active = [...engagedIds].map((id) => BY_ID.get(id)).filter((c) => c !== undefined)
  if (active.length === 0) return rows
  const facets = Map.groupBy(
    active.filter((condition) => condition.kind === 'filter'),
    (condition) => condition.filterGroup,
  )
  const keepers = active.filter((condition) => condition.kind === 'diagnostic')
  const hiders = active.filter((condition) => condition.kind === 'client')

  return rows.filter(
    (row) =>
      latchedRowIds?.has(row.id) ||
      ([...facets.values()].every((facet) => facet.some((c) => c.matches(row, ctx))) &&
        !hiders.some((condition) => condition.matches(row, ctx)) &&
        (keepers.length === 0 || keepers.some((condition) => condition.matches(row, ctx)))),
  )
}

export function listLabels(conditions: readonly RowConditionT[], conjunction = 'i'): string {
  const labels = conditions.map((condition) => condition.label)
  if (labels.length < 2) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} ${conjunction} ${labels[labels.length - 1]}`
}

export function engagedConditionsOfKind(
  engagedIds: ReadonlySet<string>,
  kind: RowConditionKindT,
): RowConditionT[] {
  return ROW_CONDITIONS.filter(
    (condition) => condition.kind === kind && engagedIds.has(condition.id),
  )
}

export function columnsRevealedBy(engagedIds: Iterable<string>): ReadonlySet<string> {
  const revealed = new Set<string>()
  for (const id of engagedIds) {
    for (const column of BY_ID.get(id)?.revealsColumns ?? []) revealed.add(column)
  }
  return revealed
}

export function engagedPlane(engagedIds: Iterable<string>): ToolPlaneT | undefined {
  for (const id of engagedIds) {
    const condition = BY_ID.get(id)
    if (condition?.kind === 'diagnostic' && condition.plane) return condition.plane
  }
  return undefined
}

export function isFoldSuppressed(search: string, engagedIds: ReadonlySet<string>): boolean {
  if (search.trim() !== '') return true
  for (const id of engagedIds) {
    if (id !== HAS_PLANNED_OR_AI_QTY_CONDITION_ID && BY_ID.get(id)?.kind === 'filter') return true
  }
  return false
}

// Counts run over the full dataset, never over what survived the filter — a count of the survivors
// would be a count of itself and could never reach zero to say the problem is gone.
export function countMatching(
  rows: KosztorysV2RowT[],
  conditionId: string,
  ctx: RowConditionCtxT,
): number {
  const condition = BY_ID.get(conditionId)
  if (!condition) return 0
  return rows.reduce((count, row) => (condition.matches(row, ctx) ? count + 1 : count), 0)
}

export function rowIdsMatching(
  rows: KosztorysV2RowT[],
  conditionIds: ReadonlySet<string>,
  ctx: RowConditionCtxT,
): ReadonlySet<number> {
  const conditions = [...conditionIds].flatMap((id) => BY_ID.get(id) ?? [])
  return new Set(
    rows
      .filter((row) => conditions.some((condition) => condition.matches(row, ctx)))
      .map((row) => row.id),
  )
}

export const liftsToSections = (
  condition: RowConditionT,
): condition is FilterConditionT & { sectionLabel: string } =>
  condition.kind === 'filter' && condition.sectionLabel !== null

export function sectionIdsWhereAllMatch(
  rows: KosztorysV2RowT[],
  conditionId: string,
  ctx: RowConditionCtxT,
): Set<number> {
  const condition = BY_ID.get(conditionId)
  const result = new Set<number>()
  if (!condition) return result
  const failed = new Set<number>()
  for (const row of rows) {
    if (condition.matches(row, ctx)) result.add(row.sectionId)
    else failed.add(row.sectionId)
  }
  for (const sectionId of failed) result.delete(sectionId)
  return result
}

/**
 * An ENGAGED condition is listed regardless of the gate: it is narrowing the pozycje right now, and the
 * menu is where its tick comes off.
 */
export function offeredFilterConditions({
  engagedIds,
  perItemDiscountInert,
  crewAxis,
  isTemplate,
}: {
  engagedIds: ReadonlySet<string>
  perItemDiscountInert: boolean
  crewAxis: CrewAxisT
  isTemplate: boolean
}): FilterConditionT[] {
  return ROW_CONDITIONS.filter((condition) => condition.kind === 'filter').filter(
    (condition) =>
      engagedIds.has(condition.id) ||
      (!(perItemDiscountInert && condition.inertUnderGlobalDiscount) &&
        (condition.plane === undefined || crewAxisShows(crewAxis, condition.plane)) &&
        (!isTemplate ||
          (condition.revealsColumns?.every((id) => WORKSHOP_VISIBLE_COLUMNS.has(id)) ?? false))),
  )
}

const AI_REVIEW_FILTER_IDS: ReadonlySet<string> = new Set(
  ROW_CONDITIONS.filter(
    (condition) => condition.kind === 'filter' && condition.filterGroup === 'ai-review',
  ).map((condition) => condition.id),
)

const INERT_UNDER_GLOBAL_DISCOUNT_IDS: ReadonlySet<string> = new Set(
  ROW_CONDITIONS.filter(
    (condition) => condition.kind === 'filter' && condition.inertUnderGlobalDiscount,
  ).map((condition) => condition.id),
)

/**
 * The „Przegląd AI" filters count only while the view is on, so a pick remembered from the last pass
 * shows no chip and no (0) entry on a visit that never switched it on. The rabat pair counts only
 * without a global rabat, where it matches nothing and would empty the grid.
 */
export function editorConditionIds(
  persistedIds: ReadonlySet<string>,
  aiReview: boolean,
  globalDiscountActive: boolean,
): ReadonlySet<string> {
  const drops = (id: string) =>
    (!aiReview && AI_REVIEW_FILTER_IDS.has(id)) ||
    (globalDiscountActive && INERT_UNDER_GLOBAL_DISCOUNT_IDS.has(id))
  if (![...persistedIds].some(drops)) return persistedIds
  return new Set([...persistedIds].filter((id) => !drops(id)))
}

// Module-level instances, so the sets below are referentially stable and the editor's memos don't
// recompute on every render.
const CLIENT_EMPTY_CONDITION_IDS: ReadonlySet<string> = new Set([CLIENT_EMPTY_CONDITION_ID])
const REPORTED_ONLY_CONDITION_IDS: ReadonlySet<string> = new Set([REPORT_UNREPORTED_CONDITION_ID])
const NO_CONDITION_IDS: ReadonlySet<string> = new Set()

export function clientConditionIds(
  hideEmptyRows: boolean | undefined,
  reportedOnly = false,
): ReadonlySet<string> {
  if (reportedOnly) return REPORTED_ONLY_CONDITION_IDS
  return hideEmptyRows ? CLIENT_EMPTY_CONDITION_IDS : NO_CONDITION_IDS
}
