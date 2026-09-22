import { planeViewSuffix } from '@/lib/kosztorys/constants'
import { PROBLEM_GROUPS } from '@/lib/kosztorys/problem-groups'
import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions/registry'
import { STAGE_CONDITIONS } from '@/lib/kosztorys/stage-conditions'

/**
 * The one definition of what counts as a problem — the menu, the exclusive pick, the row latch and
 * the stage narrowing all read it, so they cannot answer „co jest tu zepsute" four different ways.
 *
 * Both registries feed one list. They stay separate registries because pozycje and etapy are different
 * subjects, but to the reader they are one question, distinguished only by the noun each row names.
 *
 * Order: by category (`PROBLEM_GROUPS`), and inside a category the problems that read as a whole
 * sentence come last. The sentence ones are a statement about the INVESTMENT rather than one more
 * thing to look at, they wrap over three lines, and they light up in bulk — put among the terse rows
 * they push the short problems off the bottom of their heading.
 *
 * Here rather than beside the menu that renders it: nothing about this is React, and the editor's own
 * composition root reads it too — importing it up out of a leaf toolbar folder inverted the layering.
 */
const ROW_PROBLEMS = ROW_CONDITIONS.filter((condition) => condition.kind === 'diagnostic').map(
  (condition) => ({
    id: condition.id,
    // Capitalized because it OPENS the row — the list is a set of statements about the kosztorys, not
    // a set of commands.
    noun: 'Pozycje',
    // Without the „w widoku …" tail the registry hangs on a one-plane condition: here the heading
    // above the row already says which view it is, and repeating it made every second row a line
    // longer for nothing. Everywhere else — the „Filtry" menu, the empty state — there is no heading
    // to lean on, so the tail stays on the condition itself.
    label: condition.plane
      ? condition.label.replace(planeViewSuffix(condition.plane), '')
      : condition.label,
    // Both versions, because the two surfaces differ on exactly this: the menu row has a heading over
    // it, the chip in the pasku zaangażowanych zawężeń has nothing — and it renders precisely when the
    // narrowing is ON, which is the moment the reader most needs to know which crew it judged.
    fullLabel: condition.label,
    sentence: condition.problemLabel,
    group: condition.problemGroup,
  }),
)

// The whole stage registry is one category: an etap defect is always read and fixed in the etap
// columns, so asking each condition to name a heading would be asking it to repeat the registry.
const STAGE_PROBLEMS = STAGE_CONDITIONS.map((condition) => ({
  id: condition.id,
  noun: 'Etapy',
  label: condition.label,
  // An etap names no plane, so there is nothing to strip — the field exists so the chip never has to
  // ask which registry a problem came from.
  fullLabel: condition.label,
  sentence: undefined,
  group: 'scope-stages' as const,
}))

export const PROBLEM_CONDITIONS = PROBLEM_GROUPS.flatMap((group) => {
  const inGroup = [...ROW_PROBLEMS, ...STAGE_PROBLEMS].filter(
    (problem) => problem.group === group.id,
  )

  return [
    ...inGroup.filter((problem) => !problem.sentence),
    ...inGroup.filter((problem) => problem.sentence),
  ].map((problem) => ({ ...problem, group: group.id, groupLabel: group.label }))
})

/** Every problem id, engaged or not — what an exclusive pick has to clear to stay exclusive. */
export const PROBLEM_IDS = PROBLEM_CONDITIONS.map((problem) => problem.id)

const STAGE_PROBLEM_IDS = STAGE_CONDITIONS.map((condition) => condition.id)

/** The problems currently engaged — the row latch holds rows for these and for nothing else. */
export function engagedProblemIds(engaged: ReadonlySet<string>): Set<string> {
  return new Set(PROBLEM_IDS.filter((id) => engaged.has(id)))
}

/** The etap half of the same set, which is what narrows the stage columns. */
export function engagedStageProblemIds(engaged: ReadonlySet<string>): Set<string> {
  return new Set(STAGE_PROBLEM_IDS.filter((id) => engaged.has(id)))
}
