import { planeViewSuffix } from '@/lib/kosztorys/format'
import { PROBLEM_GROUPS } from '@/lib/kosztorys/problem-groups'
import {
  REPORT_UNREPORTED_CONDITION_ID,
  ROW_CONDITIONS,
} from '@/lib/kosztorys/row-conditions/registry'
import { STAGE_CONDITIONS } from '@/lib/kosztorys/stage-conditions'

const ROW_PROBLEMS = ROW_CONDITIONS.filter((condition) => condition.kind === 'diagnostic').map(
  (condition) => ({
    id: condition.id,
    noun: 'Pozycje',
    label: condition.plane
      ? condition.label.replace(planeViewSuffix(condition.plane), '')
      : condition.label,
    fullLabel: condition.label,
    sentence: condition.problemLabel,
    group: condition.problemGroup,
  }),
)

const STAGE_PROBLEMS = STAGE_CONDITIONS.map((condition) => ({
  id: condition.id,
  noun: 'Etapy',
  label: condition.label,
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

export const PROBLEM_IDS = PROBLEM_CONDITIONS.map((problem) => problem.id)

const STAGE_PROBLEM_IDS = STAGE_CONDITIONS.map((condition) => condition.id)

/**
 * The row latch holds rows only for these: its release („Odśwież — ukryj poprawione") renders only
 * while a problem is engaged, so latching under a „Prace" filter would hold rows nothing can release.
 * The worker's „Tylko zgłoszone” is the one non-problem in the list — toggling it is his release.
 */
const LATCHING_IDS = [...PROBLEM_IDS, REPORT_UNREPORTED_CONDITION_ID]

export function engagedLatchingIds(engaged: ReadonlySet<string>): Set<string> {
  return new Set(LATCHING_IDS.filter((id) => engaged.has(id)))
}

export function engagedStageProblemIds(engaged: ReadonlySet<string>): Set<string> {
  return new Set(STAGE_PROBLEM_IDS.filter((id) => engaged.has(id)))
}
