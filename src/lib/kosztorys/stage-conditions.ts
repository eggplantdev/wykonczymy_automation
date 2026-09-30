import type { KosztorysStageT } from '@/lib/kosztorys/types'

/**
 * A defect an etap can carry. The stage-shaped twin of `ROW_CONDITIONS`, kept separate because the
 * subject differs — forcing a stage predicate through the row-shaped signature would mean every stage
 * condition ignoring its `row` argument.
 *
 * Deliberately smaller than the row registry: a stage condition has no kinds (all of them are
 * defects), no lifting to sekcje, and no complement — nobody asks to see the etapy that are fine.
 */
export type StageConditionT = {
  id: string
  // A bare noun phrase, so it reads after „Etapy ".
  label: string
  matches: (stage: KosztorysStageT, context: StageContextT) => boolean
}

/** What a stage predicate needs beyond the etap itself — figures only the rozpiska can answer. */
export type StageContextT = {
  // Etapy whose fixed amounts outgrew the executed work (`subcontractorDueByPlane`).
  scaledDownStageIds: ReadonlySet<number>
}

const NO_CONTEXT: StageContextT = { scaledDownStageIds: new Set() }

// The ids share one flat namespace with ROW_CONDITIONS — a single engaged-ids set drives both
// registries — so they must not collide.
export const STAGE_CONDITIONS: StageConditionT[] = [
  {
    id: 'stage-no-plane',
    label: 'bez wybranego sposobu rozliczenia',
    // A plane-less etap belongs to no crew's bill and counts toward neither settlement figure, which
    // is why the grid already renders it red and locked.
    matches: (stage) => stage.plane == null,
  },
  {
    id: 'stage-no-worker',
    // Counted independently of the one above, so a bare etap appears in both (owner): each row says
    // literally what it is written to say.
    label: 'bez przypisanego wykonawcy',
    matches: (stage) => stage.split == null,
  },
  {
    id: 'stage-split-scaled',
    // The pool dropped below the fixed amounts after the save, so they were shrunk pro rata and the
    // one taking the rest gets nothing — the owner's „popraw podział".
    label: 'z podziałem do poprawienia',
    matches: (stage, context) => context.scaledDownStageIds.has(stage.id),
  },
]

const BY_ID = new Map(STAGE_CONDITIONS.map((condition) => [condition.id, condition]))

// Like the row counts: over the full stage list handed in, never over what a narrowing left standing —
// a count of the survivors could never reach zero to say the problem is gone.
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
 * The etapy left standing once the engaged stage conditions apply — the union (OR), for the same
 * reason the row diagnostics union: under AND two engaged problems would ask for an etap that is both
 * at once, and the stage block would empty while both counts promised something to fix.
 *
 * Nothing engaged returns the input array itself, so a memo downstream sees the same reference. An id
 * nobody knows is ignored rather than matching nothing.
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
