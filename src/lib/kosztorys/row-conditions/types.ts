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
}

// 'client' is a third kind, not a third mechanism: it hides like a filter, but it is engaged by the
// investment's stored client-view settings rather than by a reading gesture, so the „Filtry" menu
// (which lists `kind === 'filter'`) cannot show it and the owner cannot untick it for themselves.
export type RowConditionKindT = 'filter' | 'diagnostic' | 'client'

export type RowConditionT = {
  id: string
  // A bare noun phrase describing the row, so it reads after „Pozycje " (the menu) and „Brak pozycji "
  // (the empty state).
  label: string
  // How it reads when it lifts to whole sekcje in the „Filtry" menu; null = it does not lift, which
  // is every kind but 'filter' — the menu is the only thing that folds sections.
  sectionLabel: string | null
  // 'filter' = a visibility toggle in the „Filtry" menu, ticked by default: the tick means „widoczne",
  // exactly like the column and section pickers, and UNticking it hides what it matches. That is why
  // filters come in complementary pairs („bez przedmiaru" / „z przedmiarem") — a picker with only one
  // half of an axis cannot express „pokaż mi tylko te drugie".
  // 'diagnostic' = a defect to close: it lives in the toolbar with a count, vanishes at zero, and when
  // engaged keeps ONLY what it matches. It is not a picker row — it answers „pokaż mi wyłącznie to, co
  // jest zepsute" — so it stays off by default and out of the menu.
  kind: RowConditionKindT
  // How a diagnostic reads, which is not the same question as what it matches. 'defect' = something is
  // wrong and someone has to fix it. 'worklist' = nothing is broken; the count is work still to do and
  // typing it away is the normal course of the job, not the clearing of a fault. Ignored by filters.
  tone?: 'defect' | 'worklist'
  // Which price plane the condition judges, for the rows that judge one at all. The id rather than a
  // glyph, so the menu can mark the row with the same icon the view switcher uses without this module
  // — or the model above it — importing React.
  plane?: ToolPlaneT
  // Columns the condition is ABOUT. While it is engaged the grid shows them even if the column picker
  // has them unticked, because narrowing to „pozycje bez ceny j.m." with „Cena j.m." hidden is the
  // right rows with the missing thing still missing. It rides the gesture, so nothing here reaches the
  // stored visibility map. Lives on the condition rather than in a lookup beside the grid: a second
  // table is exactly how the header/picker drift that column-config.ts exists to prevent comes back.
  revealsColumns?: readonly string[]
  // A whole sentence for the „Problemy" row, replacing the „Pozycje … (n)" phrasing built from
  // `label`. Opens by naming the thing like every other row, then says WHY — a problem caused by an
  // investment-wide fact is unreadable as a bare noun phrase. Takes the count because it owns the
  // whole row: the plane rides in the same parentheses, and a second pair after it read as a typo.
  problemLabel?: (count: number) => string
  matches: (row: KosztorysV2RowT, ctx: RowConditionCtxT) => boolean
}
