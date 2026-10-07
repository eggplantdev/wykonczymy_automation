import type { FilterGroupIdT } from '@/lib/kosztorys/filter-groups'
import type { ProblemGroupIdT } from '@/lib/kosztorys/problem-groups'
import type { KosztorysStageT, KosztorysV2RowT, ToolPlaneT } from '@/lib/kosztorys/types'

export type RowConditionCtxT = {
  stages: KosztorysStageT[]
  // Whether the INVESTMENT has any material folded into robocizna (a „wliczony w robociznę" wydatek).
  // The one fact here that the kosztorys itself cannot answer — it lives on the wydatki side, with no
  // per-pozycja link — and the gate the overpaid-crew guard below hangs on. Required rather than
  // optional on purpose: a money guard that silently never fires because a host forgot to pass it is
  // worth less than no guard at all.
  hasSettledMaterial: boolean
  // Ids of the pozycje whose praca is priced differently elsewhere in the kosztorys — computed by
  // `divergentPriceRowIds` one floor up, because it is a question about a GROUP of rows and every
  // `matches` here sees exactly one. Required for the same reason as the field above, plus a second:
  // grouping is O(rows), and a host that computed it inside `matches` would pay it once per pozycja.
  divergentPriceRowIds: ReadonlySet<number>
  // Pomiar (Σ etapów na planie klienta) policzony raz na pozycję, keyed by row id — the six conditions
  // below that ask it would otherwise each recompute the same ten-column sum for the same pozycja, and
  // a full set of counters asks it ~2.6× per pozycja (EX-768, zmierzone na 1000 pozycjach).
  //
  // Optional where `divergentPriceRowIds` is required, and the difference is what a missing value
  // COSTS: there it would be a money guard silently answering „no", here it is the same number
  // computed the slow way. So a host that skips it stays correct and only pays what it paid before —
  // which is why the spec fixtures and single-shot callers do not carry one.
  qtyDoneByRowId?: ReadonlyMap<number, number>
  // The two katalog verdicts, precomputed per pozycja one floor up — same reason as
  // `divergentPriceRowIds`: the question is about the whole rozpiska read against the cennik, and
  // every `matches` here sees one row.
  //
  // Optional, unlike the money guard above: a host with no cennik (the podglądy, the spec fixtures)
  // has nothing to compare against, and „no katalog" must read as „no counter" rather than as
  // „the cennik is empty", which would report every single praca as missing from it.
  catalogueRowIds?: { divergent: ReadonlySet<number>; missing: ReadonlySet<number> }
  // Whether an agent draft was loaded into this kosztorys (`hasAiDraft`). Optional on the same footing
  // as `catalogueRowIds`: absent reads as „no AI draft", so the review counters stay silent on every
  // host that does not review one.
  hasAiDraft?: boolean
  // „Przegląd AI" is on. The filters that read the draft follow the columns that show it — without
  // them the manager cannot see why a pozycja was kept or hidden.
  aiColumnsShown?: boolean
}

type RowConditionBaseT = {
  id: string
  // A bare noun phrase describing the row, so it reads after „Ukryto: pozycje " (the active-filters
  // bar) and „Brak pozycji " (the empty state).
  label: string
  // Which price plane the condition judges. Carried by diagnostics AND by the ten plane-bound filters:
  // the „Stawki wykonawców" axis gates a filter row by the same answer it gates that plane's columns
  // by, so the two cannot say different things. `engagedPlane` still reads diagnostics only — it gates
  // on the kind for exactly that reason, since a filter is a picker row several of which can be
  // unticked at once and moving the grid under a tick could not be undone.
  // The id rather than a glyph, so the menu can mark the row with the same icon the view switcher uses
  // without this module — or the model above it — importing React.
  plane?: ToolPlaneT
  // Columns the condition is ABOUT. While it is engaged the grid shows them even if the column picker
  // has them unticked, because narrowing to „pozycje bez ceny j.m." with „Cena j.m." hidden is the
  // right rows with the missing thing still missing. It rides the gesture, so nothing here reaches the
  // stored visibility map. Lives on the condition rather than in a lookup beside the grid: a second
  // table is exactly how the header/picker drift that column-config.ts exists to prevent comes back.
  revealsColumns?: readonly string[]
  matches: (row: KosztorysV2RowT, ctx: RowConditionCtxT) => boolean
}

// A visibility toggle in the „Filtry" menu, ticked by default: the tick means „widoczne", exactly like
// the column and section pickers, and UNticking it hides what it matches. That is why filters come in
// complementary pairs („bez przedmiaru" / „z przedmiarem") — a picker with only one half of an axis
// cannot express „pokaż mi tylko te drugie".
export type FilterConditionT = RowConditionBaseT & {
  kind: 'filter'
  // Which heading the „Filtry" menu files the row under. The menu lists by heading and has no „Inne"
  // bucket, so a filter without one would silently never be listed.
  filterGroup: FilterGroupIdT
  // The „Filtry" row, when the noun phrase is too long to scan there. The menu is a LIST under a
  // heading that already says what the rows are about, so it names the value („Kwota stała") where a
  // sentence has to name the subject too („pozycje ze stawką wykonawcy z kwoty stałej") — five words
  // of shared preamble per row, repeated six times, is what made the list unreadable. Omitted = the
  // menu capitalises `label`, which is what a short one already reads like.
  menuLabel?: string
  // How it reads when it lifts to whole sekcje in the „Filtry" menu; null = it does not lift.
  sectionLabel: string | null
  // Its `matches` must return false under a global rabat: a filter persisted in localStorage from
  // before the global rabat was switched on goes around the menu and must not blank the kosztorys.
  inertUnderGlobalDiscount?: true
}

// A defect to close: it lives in the toolbar with a count, vanishes at zero, and when engaged keeps
// ONLY what it matches. It is not a picker row — it answers „pokaż mi wyłącznie to, co jest zepsute" —
// so it stays off by default and out of the „Filtry" menu.
export type DiagnosticConditionT = RowConditionBaseT & {
  kind: 'diagnostic'
  // Which heading the „Problemy" menu files the row under — required for the same reason as
  // `filterGroup`.
  problemGroup: ProblemGroupIdT
  // A whole sentence for the „Problemy" row, replacing the „Pozycje … (n)" phrasing built from
  // `label`. Opens by naming the thing like every other row, then says WHY — a problem caused by an
  // investment-wide fact is unreadable as a bare noun phrase. Takes the count because it owns the
  // whole row: the plane rides in the same parentheses, and a second pair after it read as a typo.
  problemLabel?: (count: number) => string
}

// A third kind, not a third mechanism: it hides like a filter, but it is engaged by the investment's
// stored client-view settings rather than by a reading gesture, so the „Filtry" menu (which lists
// `kind === 'filter'`) cannot show it and the owner cannot untick it for themselves.
export type ClientConditionT = RowConditionBaseT & { kind: 'client' }

export type RowConditionT = FilterConditionT | DiagnosticConditionT | ClientConditionT

export type RowConditionKindT = RowConditionT['kind']
