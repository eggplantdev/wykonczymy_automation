import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions/registry'
import { STAGE_CONDITIONS } from '@/lib/kosztorys/stage-conditions'

/**
 * The one definition of what counts as a problem — the menu, the exclusive pick, the row latch and
 * the stage narrowing all read it, so they cannot answer „co jest tu zepsute" four different ways.
 *
 * Both registries feed one list. They stay separate registries because pozycje and etapy are different
 * subjects, but to the reader they are one question, distinguished only by the noun each row names.
 *
 * Order: pozycje, then etapy, then the problems that read as a whole sentence. The sentence ones are
 * a statement about the INVESTMENT rather than one more thing to look at, they wrap over three lines,
 * and they light up in bulk — put among the terse rows they push the short problems off the bottom of
 * the list, so they sit last.
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
    label: condition.label,
    sentence: condition.problemLabel,
  }),
)

export const PROBLEM_CONDITIONS = [
  ...ROW_PROBLEMS.filter((problem) => !problem.sentence),
  ...STAGE_CONDITIONS.map((condition) => ({
    id: condition.id,
    noun: 'Etapy',
    label: condition.label,
    sentence: undefined,
  })),
  ...ROW_PROBLEMS.filter((problem) => problem.sentence),
]

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
