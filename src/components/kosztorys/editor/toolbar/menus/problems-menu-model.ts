import { PROBLEM_CONDITIONS } from '@/lib/kosztorys/problem-conditions'

export type ProblemToggleT = {
  id: string
  label: string
  groupLabel: string
  active: boolean
}

type ArgsT = {
  engagedIds: ReadonlySet<string>
  counts: ReadonlyMap<string, number>
}

/**
 * The ENGAGED one is the exception and stays at „(0)": dropping its row would take the off switch away
 * while the narrowing it turned on is still in force.
 */
export function problemsMenuModel({ engagedIds, counts }: ArgsT): ProblemToggleT[] {
  return PROBLEM_CONDITIONS.map((problem) => ({
    ...problem,
    // How many pozycje are in that state, not how many the row is currently showing — a count of the
    // survivors would be a count of itself and could never reach zero to say the problem is gone.
    count: counts.get(problem.id) ?? 0,
  }))
    .filter((problem) => problem.count > 0 || engagedIds.has(problem.id))
    .map((problem) => ({
      id: problem.id,
      groupLabel: problem.groupLabel,
      label:
        problem.sentence?.(problem.count) ?? `${problem.noun} ${problem.label} (${problem.count})`,
      active: engagedIds.has(problem.id),
    }))
}
