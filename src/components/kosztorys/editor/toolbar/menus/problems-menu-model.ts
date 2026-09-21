import { PROBLEM_CONDITIONS } from '@/lib/kosztorys/problem-conditions'

export type ProblemToggleT = {
  id: string
  label: string
  // The heading this row belongs under. Carried per row rather than returned as nested groups: the
  // list is already ordered by category, so the menu only has to notice where the label changes — and
  // every existing reader still gets one flat list of rows.
  groupLabel: string
  active: boolean
}

type ArgsT = {
  engagedIds: ReadonlySet<string>
  // Per condition id, how many pozycje / etapy are in that state across the whole dataset.
  counts: ReadonlyMap<string, number>
}

/**
 * The „Problemy" arithmetic, away from the component: which problems there are to offer and which one
 * is engaged. Extracted because this is the part worth testing and the markup around it is not.
 *
 * One problem at a time, which is why there is no union arithmetic here any more: two engaged at once
 * showed the sum of two unrelated sets with nothing on screen saying which row came from which, and
 * the reveal from phase 4 made that worse — the columns of both problems arrived together.
 *
 * Each row NAMES what is wrong („Pozycje bez ceny j.m. (9)") rather than commanding („Pokaż …"): the
 * list is read first as a report of what the kosztorys is missing, and the narrowing is what a click
 * does with it. A problem with nothing to report is absent rather than shown at
 * zero — a problem list is read for what is on it, and six permanently-zero rows would bury the one
 * that isn't.
 *
 * The ENGAGED one is the exception and stays at „(0)": fixing the last match is the successful ending
 * of the gesture, and dropping its row there would take the off switch away while the narrowing it
 * turned on is still in force — the grid stays cut down to the held pozycje (or, for an etap problem,
 * to no etap columns at all) with nothing on screen to release it. That is also why an empty list is
 * what makes the trigger disappear: the button reports the DATA, not the gesture, and it is the only
 * way back out of a narrowing it started.
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
