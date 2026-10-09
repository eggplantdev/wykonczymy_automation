import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'

export type WorkerScopeBlockReasonT = 'no-stages' | 'unconfirmed-plane' | 'mixed-planes'

export type WorkerScopeT =
  | { kind: 'ready'; plane: ToolPlaneT; stages: KosztorysStageT[] }
  | { kind: 'blocked'; reason: WorkerScopeBlockReasonT }

export const isStageMember = (stage: KosztorysStageT | undefined, workerId: number): boolean =>
  stage?.split?.members.some((member) => member.workerId === workerId) ?? false

/**
 * Which etapy a worker's view shows, and whether it may show prices at all. The one decision the
 * „Pracownicy" menu (disable), the mint action (refuse) and the page (notice instead of prices) all
 * read, so the three cannot disagree about a worker.
 *
 * A priced view needs exactly one stawka per pozycja: a plane-less etap has none yet, and etapy on
 * both rozliczenia would give one „Cena j.m." two meanings (design #11). The unconfirmed plane is
 * reported first — it is the fix the owner makes in the same menu.
 */
export function resolveWorkerScope(stages: KosztorysStageT[], workerId: number): WorkerScopeT {
  const own = stages.filter((stage) => isStageMember(stage, workerId))
  if (own.length === 0) return { kind: 'blocked', reason: 'no-stages' }
  const planes = new Set<ToolPlaneT>()
  for (const stage of own) {
    if (stage.plane === null) return { kind: 'blocked', reason: 'unconfirmed-plane' }
    planes.add(stage.plane)
  }
  if (planes.size > 1) return { kind: 'blocked', reason: 'mixed-planes' }
  const [plane] = planes
  return { kind: 'ready', plane, stages: own }
}

export type ReportScopeRefusalT = WorkerScopeBlockReasonT | 'stages-completed'

// The view keeps zakończone etapy — his settlement stays readable — but a report names no etap, so
// he may report only while at least one of his etapy here is still open (EX-1034).
export const hasOpenStage = (ownStages: KosztorysStageT[]): boolean =>
  ownStages.some((stage) => !stage.completed)

/** Why this worker may not report here — the link, the send and the scan all refuse on it. */
export function reportScopeRefusal(scope: WorkerScopeT): ReportScopeRefusalT | null {
  if (scope.kind === 'blocked') return scope.reason
  return hasOpenStage(scope.stages) ? null : 'stages-completed'
}
