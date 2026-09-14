import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions/registry'
import type {
  RowConditionCtxT,
  RowConditionKindT,
  RowConditionT,
} from '@/lib/kosztorys/row-conditions/types'
import type { KosztorysV2RowT, ToolPlaneT } from '@/lib/kosztorys/types'

const BY_ID = new Map(ROW_CONDITIONS.map((condition) => [condition.id, condition]))

/**
 * The rows left on screen once the engaged conditions apply. „Engaged" is the non-default state, and
 * it means opposite things per kind because the two are asked differently — a filter is a picker row
 * that starts ticked, a diagnostic is a button that starts off:
 *
 *  • 'filter' — engaged = UNticked in the menu, so it removes its matches. They stack (AND): each one
 *    you untick takes more away, exactly like unticking sections or columns.
 *  • 'diagnostic' — engaged = pressed in the toolbar, so it keeps ONLY its matches. Together they show
 *    the UNION (OR). Under AND, „bez ceny j.m. (9)" and „z rozjazdem pomiaru (5)" would ask for
 *    pozycje that are both at once — almost always none — and the grid would go blank while the two
 *    badges promised 14 things to fix. Each badge counts its own condition, so the grid shows the sum.
 *
 * An empty set is a no-op, and an id nobody knows is ignored rather than matching nothing — a filter
 * persisted under a condition that has since been removed must not hide the whole kosztorys.
 */
// Keepers are named explicitly and everything else hides: a fourth kind added later must not fall
// through into „keep only what it matches", which would blank the grid rather than hide a row. The
// empty state asks the same question through `engagedHiders`, so both sides gain that kind at once.
const isHider = (condition: RowConditionT) => condition.kind !== 'diagnostic'

export function applyRowConditions(
  rows: KosztorysV2RowT[],
  engagedIds: Iterable<string>,
  ctx: RowConditionCtxT,
  // Row ids the conditions may no longer remove — see `useConditionRowLatch`, which owns when a row
  // enters this set. Here it is deliberately a blunt bypass rather than a per-condition exemption:
  // the reason a row is held is that the user is working on it, and that reason is indifferent to
  // which of the engaged conditions stopped matching.
  latchedRowIds?: ReadonlySet<number>,
): KosztorysV2RowT[] {
  const active = [...engagedIds].map((id) => BY_ID.get(id)).filter((c) => c !== undefined)
  if (active.length === 0) return rows
  const keepers = active.filter((condition) => !isHider(condition))
  const hiders = active.filter(isHider)

  return rows.filter(
    (row) =>
      latchedRowIds?.has(row.id) ||
      (!hiders.some((condition) => condition.matches(row, ctx)) &&
        (keepers.length === 0 || keepers.some((condition) => condition.matches(row, ctx)))),
  )
}

/**
 * „bez przedmiaru, bez ceny j.m. i z rozjazdem pomiaru" — the labels as one readable Polish list.
 * The conjunction is the caller's because it has to match how the conditions actually combined: „i"
 * for the filters that stack, „ani" after a negation for the diagnostics that union.
 */
export function listLabels(conditions: readonly RowConditionT[], conjunction = 'i'): string {
  const labels = conditions.map((condition) => condition.label)
  if (labels.length < 2) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} ${conjunction} ${labels[labels.length - 1]}`
}

/** The engaged ids of one kind, in registry order — the menu and the toolbar each own one kind. */
export function engagedConditionsOfKind(
  engagedIds: ReadonlySet<string>,
  kind: RowConditionKindT,
): RowConditionT[] {
  return ROW_CONDITIONS.filter(
    (condition) => condition.kind === kind && engagedIds.has(condition.id),
  )
}

/**
 * The columns the engaged conditions are about, unioned. The grid shows these regardless of the column
 * picker's stored tick for as long as the gesture lasts; disengaging hands them straight back to
 * whatever the user had chosen, because nothing here is ever written down.
 *
 * It overrides the PICKER only. The money axis, the layer, the przedmiar gate and the client preview
 * answer different questions, and a filter that forced a brutto column onto someone reading netto
 * would be answering one of them on their behalf.
 */
export function columnsRevealedBy(engagedIds: Iterable<string>): ReadonlySet<string> {
  const revealed = new Set<string>()
  for (const id of engagedIds) {
    for (const column of BY_ID.get(id)?.revealsColumns ?? []) revealed.add(column)
  }
  return revealed
}

/**
 * The plane the engaged set is being read on, or undefined when nothing engaged names one. Answerable
 * only because the „Problemy" list is single-choice; the first match wins rather than the set being
 * asserted to hold one, since a stale id from an older registry must not make the grid unreadable.
 *
 * Diagnostics ONLY, even though filters can name a plane too. A problem is a gesture — you press it,
 * it takes you where the fault is, you press it again and you are back. A filter is a picker row that
 * happens to be about one plane, and several can be unticked at once: letting those move the view
 * would switch the grid out from under a tick and then leave it there, since unticking the other half
 * of the pair names the same plane and cannot undo the move.
 */
export function engagedPlane(engagedIds: Iterable<string>): ToolPlaneT | undefined {
  for (const id of engagedIds) {
    const condition = BY_ID.get(id)
    if (condition?.kind === 'diagnostic' && condition.plane) return condition.plane
  }
  return undefined
}

/** The engaged conditions that REMOVE rows — what an empty grid has to explain. */
export function engagedHiders(engagedIds: ReadonlySet<string>): RowConditionT[] {
  return ROW_CONDITIONS.filter((condition) => isHider(condition) && engagedIds.has(condition.id))
}

/**
 * Whether the folds have to stand down for now — the reader is narrowing, and a fold left over from
 * before would hide the very pozycje the narrowing was asked to find, behind a band that gives no
 * hint they are there.
 *
 * Both of the reader's narrowings count, because both fail the same way: a hit inside a folded sekcja
 * is a hit the user is told does not exist.
 *
 * Two hiders are left out on purpose. A diagnostic comes with its own count on its own trigger, so
 * the reader is checking off a number they were given rather than hunting for a pozycja they believe
 * is in there. And the client's own hider is not a gesture at all — it is the owner's stored setting
 * on the shared document, on for the client's whole visit, so counting it would stand the folds down
 * permanently and leave the client clicking a band that never moves.
 */
export function isFoldSuppressed(search: string, engagedIds: ReadonlySet<string>): boolean {
  if (search.trim() !== '') return true
  // Walks the engaged ids (0–2 of them), not the registry — the question is about what the reader
  // switched on, and asking it the other way round grows with every condition ever added.
  for (const id of engagedIds) if (BY_ID.get(id)?.kind === 'filter') return true
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

/**
 * The conditions the „Sekcje …" half of the „Filtry" menu offers, and so exactly the ones worth
 * computing a `sectionIdsWhereAllMatch` set for. `sectionLabel === null` is the registry entry saying
 * „this one does not lift" — a diagnostic never lifts either, since it keeps rows rather than hiding
 * them and a section-wide keep is not a fold.
 */
export const liftsToSections = (
  condition: RowConditionT,
): condition is RowConditionT & { sectionLabel: string } =>
  condition.kind === 'filter' && condition.sectionLabel !== null

/**
 * Lift a condition to whole sections: those where EVERY pozycja matches (`∀`). Not „suma = 0" — a
 * sum can reach zero by accident, „wszystkie co do jednej" cannot.
 *
 * A section with no rows cannot qualify vacuously; it simply never appears in `rows`.
 */
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
