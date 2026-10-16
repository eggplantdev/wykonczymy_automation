import type { KosztorysStageT } from '@/lib/kosztorys/types'

export type StageConditionT = {
  id: string
  // A bare noun phrase, so it reads after „Etapy ".
  label: string
  matches: (stage: KosztorysStageT, context: StageContextT) => boolean
}

export type StageContextT = {
  scaledDownStageIds: ReadonlySet<number>
}

const NO_CONTEXT: StageContextT = { scaledDownStageIds: new Set() }

// The ids share one flat namespace with ROW_CONDITIONS — a single engaged-ids set drives both
// registries — so they must not collide.
export const STAGE_CONDITIONS: StageConditionT[] = [
  {
    id: 'stage-no-plane',
    label: 'bez wybranego sposobu rozliczenia',
    matches: (stage) => stage.plane == null,
  },
  {
    id: 'stage-no-worker',
    label: 'bez przypisanego wykonawcy',
    matches: (stage) => stage.split == null,
  },
  {
    id: 'stage-split-scaled',
    label: 'z podziałem do poprawienia',
    matches: (stage, context) => context.scaledDownStageIds.has(stage.id),
  },
]

const BY_ID = new Map(STAGE_CONDITIONS.map((condition) => [condition.id, condition]))

// Like the row counts: over the full stage list handed in, never over what a narrowing left
// standing — a count of the survivors could never reach zero to say the problem is gone.
export function countMatchingStages(
  stages: KosztorysStageT[],
  conditionId: string,
  context: StageContextT = NO_CONTEXT,
): number {
  const condition = BY_ID.get(conditionId)
  if (!condition) return 0
  return stages.reduce((count, stage) => (condition.matches(stage, context) ? count + 1 : count), 0)
}

/**
 * The etapy left standing once the engaged stage conditions apply — the union (OR): under AND two
 * engaged problems would ask for an etap that is both at once, and the stage block would empty while
 * both counts promised something to fix.
 */
export function stagesMatchingEngaged(
  stages: KosztorysStageT[],
  engagedIds: Iterable<string>,
  context: StageContextT = NO_CONTEXT,
): KosztorysStageT[] {
  const active = [...engagedIds].map((id) => BY_ID.get(id)).filter((c) => c !== undefined)
  if (active.length === 0) return stages
  return stages.filter((stage) => active.some((condition) => condition.matches(stage, context)))
}
