import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { resolveWorkerScope, type WorkerScopeT } from '@/lib/kosztorys/worker-view/scope'

export type AssignedWorkerT = { id: number; name: string; scope: WorkerScopeT }

/**
 * The „Pracownicy" menu's rows: every worker who holds an etap, once, in etap order, then everyone
 * else still holding a live link — unpinned from every etap, they resolve to „Brak przypisanych
 * etapów" and stay listed only so the link can be switched off. Named from the whole roster,
 * inactive included — a person deactivated mid-investment still owns their etapy and is still owed
 * for them (design #12).
 */
export function assignedWorkers(
  stages: KosztorysStageT[],
  roster: readonly { id: number; name: string }[],
  linkHolders: ReadonlySet<number>,
): AssignedWorkerT[] {
  const names = new Map(roster.map((worker) => [worker.id, worker.name]))
  const seen = new Set<number>()
  const assigned: AssignedWorkerT[] = []
  const stageWorkerIds = stages.flatMap(
    ({ split }) => split?.members.map((member) => member.workerId) ?? [],
  )
  for (const workerId of [...stageWorkerIds, ...linkHolders]) {
    if (seen.has(workerId)) continue
    seen.add(workerId)
    const name = names.get(workerId)
    if (name === undefined) continue
    assigned.push({ id: workerId, name, scope: resolveWorkerScope(stages, workerId) })
  }
  return assigned
}
