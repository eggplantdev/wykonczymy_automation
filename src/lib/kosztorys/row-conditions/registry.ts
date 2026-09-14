import { overrideValueFor, subcontractorPrice } from '@/lib/kosztorys/calc'
import { PLANE_LABELS } from '@/lib/kosztorys/constants'
import { ALL_PLANE_PRICE_KEYS, planePriceKeysFor } from '@/lib/kosztorys/plane-price-keys'
import type { RowConditionCtxT, RowConditionT } from '@/lib/kosztorys/row-conditions/types'
import { measureDiscrepancy, rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import type { KosztorysV2RowT, ToolPlaneT } from '@/lib/kosztorys/types'

// The pomiar, from the host's precomputed map when there is one and the long way when there is not.
// Six entries below ask this question, so reading it through one accessor is also what keeps them
// from drifting onto different planes.
const qtyDone = (row: KosztorysV2RowT, ctx: RowConditionCtxT) =>
  ctx.qtyDoneByRowId?.get(row.id) ?? rowTotalQtyDone(row, ctx.stages, 'client')

// Named once so the pair below cannot be edited apart — „bez rabatu" is „ma rabat" negated, and two
// hand-written copies of a three-term test are two chances to change only one of them.
const hasItemDiscount = (row: KosztorysV2RowT) => row.discountType !== null && row.discountValue > 0

// Both the symptom and the cells that set it: the price is what is wrong, „Źródło ceny wykonawcy" and
// „Cena j.m." are where it is made right, so revealing the figure alone shows a number nobody can act
// on (owner, explicit). The client's own cena j.m. rides along because every stawka wykonawcy derives
// from it — it is assembled only in „Inwestor", so from a crew view that half of the reveal is inert.
//
// A condition that names a plane reveals THAT plane's pair, never both: answering a question about
// one crew by putting four columns on screen is how a reveal stops being readable.
const priceColumnsFor = (plane: ToolPlaneT): readonly string[] => [
  'price',
  ...planePriceKeysFor(plane),
]

// A missing cena j.m. is missing from BOTH stawki at once — there is no plane to narrow to, so „bez
// ceny j.m." reveals everything the fix could be typed into.
const ALL_PRICE_COLUMNS: readonly string[] = ['price', ...ALL_PLANE_PRICE_KEYS]

// Named because the grid reads it too: the „Rozjazd między arkuszem Google a apką" column exists only while this
// diagnostic is pressed, so the id is shared between the registry and the column assembly.
export const MEASURE_DIVERGED_CONDITION_ID = 'measure-diverged'

// The rabat pair, named because the menu drops it under a global rabat — the same call the grid makes
// for the rabat COLUMNS (column-config.ts' DISCOUNT_COLUMN_IDS). Kept beside the entries rather
// than restated in the menu, so adding a third rabat condition cannot leave the two lists disagreeing.
export const DISCOUNT_CONDITION_IDS: ReadonlySet<string> = new Set(['has-discount', 'no-discount'])

/**
 * The overpaid-crew guard (EX-708): on this plane, is the pozycja's executed work being settled at a
 * stawka that is a PERCENTAGE of the cena j.m.?
 *
 * Where material is priced into the cena j.m., a percentage hands the crew a cut of material they
 * never buy — the sheet-side incident this exists to stop. Only a flat 'amount' escapes: an inherited
 * multiplier and a hand-typed one are the same fault, so the test is „not 'amount'" rather than „no
 * override". The convention it enforces is the owner's — on such pozycje the stawka is typed as a
 * fixed kwota.
 *
 * Gated on work actually executed, and read through the etap that carries it: a pozycja holds a
 * stawka on both planes at once, and the etap is what says which one will really be paid. An etap
 * with no crew assigned counts toward BOTH — whichever crew turns out to have done it gets a cut of
 * the material, and undecided is the state most kosztorysy sit in while the work is happening, so
 * treating it as „nobody is paid" would silence the guard exactly when it still could be acted on.
 */
function settledAtPercentRate(
  row: KosztorysV2RowT,
  ctx: RowConditionCtxT,
  plane: ToolPlaneT,
): boolean {
  if (!ctx.hasSettledMaterial) return false
  if (overrideValueFor(row, plane) !== null) return false
  return ctx.stages.some(
    (stage) =>
      (stage.plane === plane || stage.plane === null) && (row[stageKey(stage.id)] ?? 0) > 0,
  )
}

const percentRateProblemLabel = (plane: ToolPlaneT, count: number) =>
  `Stawki wykonawców liczone według formuły — ta inwestycja ma materiały wliczone w robociznę, ` +
  `więc stawki liczone ze współczynnika będą zawyżone i powinny być wpisane ręcznie ` +
  `(widok ${PLANE_LABELS[plane].toLowerCase()}, ${count})`

/**
 * Every rule-based way the editor hides a row, in display order. Text search is deliberately not
 * here: it takes an argument, so it is not a named condition anyone can tick.
 *
 * Each predicate is written `!(x > 0)` rather than `x === 0`, so a null, an undefined and a negative
 * all read as „nie ma" — the grid writes null into a cleared cell.
 */
export const ROW_CONDITIONS: RowConditionT[] = [
  {
    id: 'no-planned-qty',
    label: 'bez przedmiaru',
    sectionLabel: 'Sekcje bez przedmiaru',
    kind: 'filter',
    matches: (row) => !(row.plannedQty > 0),
  },
  {
    id: 'has-planned-qty',
    label: 'z przedmiarem',
    sectionLabel: 'Sekcje z przedmiarem',
    kind: 'filter',
    matches: (row) => row.plannedQty > 0,
  },
  {
    id: 'no-measured-qty',
    // Not „bez pomiaru z natury": the sheet has such a column, the grid does not — here the pomiar is
    // the sum of the ten etap columns, so the name has to point at something the user can see.
    label: 'bez wykonanej pracy',
    sectionLabel: 'Sekcje bez wykonanej pracy',
    kind: 'filter',
    // The pomiar IS Σ etapów (EX-494), at the client plane like every other whole-row reading.
    matches: (row, ctx) => !(qtyDone(row, ctx) > 0),
  },
  {
    id: 'has-measured-qty',
    label: 'z wykonaną pracą',
    sectionLabel: 'Sekcje z wykonaną pracą',
    kind: 'filter',
    matches: (row, ctx) => qtyDone(row, ctx) > 0,
  },
  // Read through `discountType`, not `discountValue` alone: under a null type the value is stored but
  // inert (`applyDiscount` walks past it), so a leftover „5" in a row whose type was cleared is not a
  // rabat. Both halves go dead under the global rabat rather than reading the raw fields, because
  // there the per-item rabat applies to nothing AND its two columns are pulled from the grid entirely
  // — narrowing on an axis with no visible cause is the trap the price diagnostics avoid by revealing
  // their columns. Dead means BOTH return false, so neither half can hide anything: a filter persisted
  // from before the global rabat was switched on must not blank the kosztorys.
  {
    id: 'has-discount',
    label: 'z rabatem',
    sectionLabel: 'Sekcje z rabatem',
    kind: 'filter',
    matches: (row) => !row.globalDiscountActive && hasItemDiscount(row),
  },
  {
    id: 'no-discount',
    label: 'bez rabatu',
    sectionLabel: 'Sekcje bez rabatu',
    kind: 'filter',
    matches: (row) => !row.globalDiscountActive && !hasItemDiscount(row),
  },
  // Split per plane for the same reason the price diagnostics are: a pozycja carries a stawka on both
  // planes at once, so one entry asking about „the active view" would answer for half the kosztorys and
  // silently leave the other half unaskable. `null` = derived from the effective coefficient, which is
  // the state „nikt tego nie tknął" — the pair exists to separate what was decided by hand from what
  // the formula produced.
  //
  // `sectionLabel: null` on all four: a whole section folded away by where its stawki came from hides
  // pricing, which is exactly the mistake „Zwiń puste sekcje" made with unpriced sections.
  {
    id: 'manual-rate-w-tools',
    label: `ze stawką wykonawcy z kwoty stałej w widoku ${PLANE_LABELS.w_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'filter',
    plane: 'w_tools',
    revealsColumns: priceColumnsFor('w_tools'),
    matches: (row) => overrideValueFor(row, 'w_tools') !== null,
  },
  {
    id: 'formula-rate-w-tools',
    label: `ze stawką wykonawcy „auto" w widoku ${PLANE_LABELS.w_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'filter',
    plane: 'w_tools',
    revealsColumns: priceColumnsFor('w_tools'),
    matches: (row) => overrideValueFor(row, 'w_tools') === null,
  },
  {
    id: 'manual-rate-own-tools',
    label: `ze stawką wykonawcy z kwoty stałej w widoku ${PLANE_LABELS.own_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'filter',
    plane: 'own_tools',
    revealsColumns: priceColumnsFor('own_tools'),
    matches: (row) => overrideValueFor(row, 'own_tools') !== null,
  },
  {
    id: 'formula-rate-own-tools',
    label: `ze stawką wykonawcy „auto" w widoku ${PLANE_LABELS.own_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'filter',
    plane: 'own_tools',
    revealsColumns: priceColumnsFor('own_tools'),
    matches: (row) => overrideValueFor(row, 'own_tools') === null,
  },
  // Trimmed before testing: the grid writes '' into a cleared cell on some paths and null on others,
  // and a komentarz of three spaces is not one. `sectionLabel: null` — „every pozycja in this section
  // lacks a comment" is true of nearly every section and names nothing worth folding.
  {
    id: 'has-note',
    label: 'z komentarzem',
    sectionLabel: null,
    kind: 'filter',
    matches: (row) => (row.note?.trim() ?? '') !== '',
  },
  {
    id: 'no-note',
    label: 'bez komentarza',
    sectionLabel: null,
    kind: 'filter',
    matches: (row) => (row.note?.trim() ?? '') === '',
  },
  {
    id: 'client-empty',
    label: 'bez przedmiaru i bez wykonanej pracy',
    // Never lifts to sekcje: „Zwiń puste sekcje" is a reading gesture in a menu the client view does
    // not render, so a label here would only buy a per-render pass over the whole dataset for a set
    // nothing reads.
    sectionLabel: null,
    kind: 'client',
    // One rule rather than the two filters above, because each of those is safe for only one of the
    // two figures a client reads: hiding no-work rows drops a priced-but-unstarted pozycja while the
    // przedmiar total still counts it, and hiding no-przedmiar rows drops a pozycja carrying etap work
    // while the executed total still counts it. A row empty on BOTH axes adds zero to both totals, so
    // hiding it moves no figure and needs no warning.
    matches: (row, ctx) => !(row.plannedQty > 0) && !(qtyDone(row, ctx) > 0),
  },
  // A missing cena j.m. is two different problems, so it is two entries, split on whether any work has
  // been executed — and split rather than added beside a broad one, so the counts stay disjoint and no
  // pozycja is reported (and chased) twice. Work already done at no price cannot be settled at all,
  // which is money; a priced-at-nothing pozycja nobody has started is only an offer still to finish.
  {
    id: 'no-client-price-with-work',
    label: 'z wykonaną pracą bez ceny j.m.',
    // A defect, not a state: a section fully executed but unpriced is exactly what must not be folded
    // away — that is the bug „Zwiń puste sekcje" had.
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    // The executed quantity alongside the price cells: engaging a problem that says „praca wykonana"
    // and showing no column carrying that work leaves the claim unverifiable on screen.
    revealsColumns: [...ALL_PRICE_COLUMNS, 'stageQtySum'],
    matches: (row, ctx) => !(row.clientPrice > 0) && qtyDone(row, ctx) > 0,
  },
  {
    id: 'no-client-price',
    // Names both halves of what it matches: shortened back to „bez ceny j.m." it would read as the
    // whole set while covering only the untouched pozycje, and come back as a bug report.
    label: 'bez ceny j.m. i bez wykonanej pracy',
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    revealsColumns: ALL_PRICE_COLUMNS,
    // The only hand-typed price; the subcontractor planes derive from it through the coefficients.
    matches: (row, ctx) => !(row.clientPrice > 0) && !(qtyDone(row, ctx) > 0),
  },
  // The third cena j.m. problem, and the only one that cannot be seen from inside a single pozycja:
  // the price is there and plausible, it just disagrees with what the same praca costs in another
  // sekcja. „worklist", not „defect" (owner, 2026-09-02) — another łazienka may be deliberately
  // dearer, so this row names something to look through, not something broken. The katalog import
  // settles the same disagreement silently by majority; this is where it becomes visible first.
  {
    id: 'divergent-client-price',
    label: 'z inną ceną j.m. niż ta sama praca gdzie indziej',
    // Folding a whole sekcja because its prices diverge would hide the very wycena being questioned.
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'worklist',
    // A whole sentence rather than „Pozycje …": the subject is the praca, not the pozycja, and the
    // pozycje are what you get to look at once you press it.
    problemLabel: (count) => `Te same prace z różnymi stawkami (${count})`,
    // Every price column, not „Cena j.m." alone: that column is built only on the „Inwestor" view
    // (kosztorys-v2-columns), so naming it by itself would reveal nothing on the two subcontractor
    // views — where the derived stawka is the only visible trace of the disagreement.
    revealsColumns: ALL_PRICE_COLUMNS,
    matches: (row, ctx) => ctx.divergentPriceRowIds.has(row.id),
  },
  {
    id: MEASURE_DIVERGED_CONDITION_ID,
    // „do rozpisania", not „z rozjazdem": the reference figure exists only where an old sheet was
    // imported, and the gap it names is work not yet entered — not a fault. Same wording as the
    // „Rozjazd między arkuszem Google a apką" column it points at.
    label: 'z pomiarem do rozpisania na etapy',
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'worklist',
    matches: (row, ctx) => measureDiscrepancy(row, ctx.stages) != null,
  },
  // Work booked against no offer. „Rozjazd między arkuszem Google a apką" cannot report it — with a przedmiar of
  // zero the percentage cell renders „—", and reddening a dash is an alarm with no legible cause — so
  // the case surfaces here instead, where the row says in words what is wrong.
  {
    id: 'work-without-planned-qty',
    label: 'z wykonaną pracą bez przedmiaru',
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    // The przedmiar alone: it is the missing cell, and it is where the fix is typed.
    revealsColumns: ['plannedQty'],
    matches: (row, ctx) => !(row.plannedQty > 0) && qtyDone(row, ctx) > 0,
  },
  // One entry per plane rather than one asking about the active view: a price exists on both planes for
  // every row, so a problem on the plane you are not looking at is still a problem, and one entry
  // asking about the active view would never surface the other crew's.
  // „zbyt wysoką", naming the direction the guard actually refuses (owner, 2026-08-17): a stawka above
  // 80% of the client price. The guard's other branch — a negative stawka — is not that, but it is
  // typo-shaped rather than a real state of the kosztorys, so it rides along unnamed instead of
  // costing the label its one clear meaning.
  //
  // „w widoku …", not „— …": the plane IS a view here, and the label names where the stawka is
  // normally read. Engaged from „Inwestor" the reveal now brings that plane's own stawka cells with
  // it, so the reader sees the judged number without switching the view out from under a click.
  {
    id: 'overpriced-w-tools',
    label: `ze zbyt wysoką stawką wykonawcy w widoku ${PLANE_LABELS.w_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    plane: 'w_tools',
    revealsColumns: priceColumnsFor('w_tools'),
    // The guard, not a restatement of the 80% rule: the filter and the red cell must never disagree.
    matches: (row) => checkSubcontractorPrice(row, 'w_tools') != null,
  },
  {
    id: 'overpriced-own-tools',
    label: `ze zbyt wysoką stawką wykonawcy w widoku ${PLANE_LABELS.own_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    plane: 'own_tools',
    revealsColumns: priceColumnsFor('own_tools'),
    matches: (row) => checkSubcontractorPrice(row, 'own_tools') != null,
  },
  // The other half of the same question, and the one an import creates: a praca whose cenniki
  // disagreed enters with an explicit 0 zł for the crew, and nothing else on screen says so — the cell
  // reads „0,00 zł" exactly like a deliberate one. `> 0` is the whole rule; the guard above judges a
  // price that exists, this one judges its absence.
  //
  // Gated on the client price so it never fires where the two cena j.m. problems already have: with no Cena j.m.
  // an auto row computes 0 zł by arithmetic, and on a fresh kosztorys that would flag every pozycja.
  // Exactly zero rather than „nie dodatnia", so a negative stawka belongs to the guard alone — read as
  // absence too it would be counted twice in the „Problemy" list and chased twice in the grid.
  {
    id: 'no-w-tools-price',
    label: `bez ceny wykonawcy w widoku ${PLANE_LABELS.w_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    plane: 'w_tools',
    revealsColumns: priceColumnsFor('w_tools'),
    matches: (row) => row.clientPrice > 0 && subcontractorPrice(row, 'w_tools') === 0,
  },
  {
    id: 'no-own-tools-price',
    label: `bez ceny wykonawcy w widoku ${PLANE_LABELS.own_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    plane: 'own_tools',
    revealsColumns: priceColumnsFor('own_tools'),
    matches: (row) => row.clientPrice > 0 && subcontractorPrice(row, 'own_tools') === 0,
  },
  // Split per plane like the two above, but for a different reason: there the stawka exists on both
  // planes whether you look or not, here the etap decides which stawka is the one being paid. So a
  // pozycja executed only „z narzędziami" appears under that half alone, and the pick switches the grid
  // to the view whose stawka is at fault.
  //
  // Named after the fault rather than the fix („od ceny z materiałem", not „nie kwotowa"): the stawka
  // is fine in itself, what is wrong is the price it is a percentage OF. Only ever counted on an
  // investment that has material folded into robocizna, so the name needs no further qualifier —
  // everywhere else the count is zero and the row never renders.
  {
    id: 'material-percent-rate-w-tools',
    label: `ze stawką wykonawcy od ceny z materiałem w widoku ${PLANE_LABELS.w_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    plane: 'w_tools',
    revealsColumns: priceColumnsFor('w_tools'),
    problemLabel: (count) => percentRateProblemLabel('w_tools', count),
    matches: (row, ctx) => settledAtPercentRate(row, ctx, 'w_tools'),
  },
  {
    id: 'material-percent-rate-own-tools',
    label: `ze stawką wykonawcy od ceny z materiałem w widoku ${PLANE_LABELS.own_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    plane: 'own_tools',
    revealsColumns: priceColumnsFor('own_tools'),
    problemLabel: (count) => percentRateProblemLabel('own_tools', count),
    matches: (row, ctx) => settledAtPercentRate(row, ctx, 'own_tools'),
  },
]

// Frozen module-level instances, so the sets below are referentially stable and the editor's memos
// don't recompute on every render.
const CLIENT_EMPTY_CONDITION_IDS: ReadonlySet<string> = new Set(['client-empty'])
const NO_CONDITION_IDS: ReadonlySet<string> = new Set()

/**
 * What a client's document engages. Every 'filter' and 'diagnostic' here is the company's own
 * bookkeeping question and is suppressed wholesale under the preview — the sole exception is the
 * 'client' condition, which the client did not choose either: it is the owner's stored decision
 * about what this document contains.
 *
 * Lives beside the registry rather than inside the editor hook that reads it, because the mapping is
 * the domain fact „which conditions may reach a client" — invisible to anyone refactoring the hook,
 * and it has been silently dropped by exactly that kind of refactor once already.
 */
export function clientConditionIds(hideEmptyRows: boolean | undefined): ReadonlySet<string> {
  return hideEmptyRows ? CLIENT_EMPTY_CONDITION_IDS : NO_CONDITION_IDS
}
