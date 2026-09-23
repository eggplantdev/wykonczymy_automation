/**
 * The headings the „Filtry" list is read under — one per axis a row asks about, in reading order.
 * Sixteen noun phrases in one column are read as one pile; under six headings the reader picks the
 * subject first and the row second, the same arrangement „Problemy" and „Sekcje" already use.
 *
 * Split by WHAT a row asks, never by the price plane it asks it on — the plane is already the tail of
 * the label (`planeViewSuffix`), and a heading repeating it would cut each stawka axis in half while
 * narrowing nothing: both halves of „ze stawką wykonawcy z kwoty stałej" are one question asked of two
 * crews, and they are read against each other.
 */
export const FILTER_GROUPS = [
  { id: 'planned-qty', label: 'Przedmiar' },
  { id: 'work-done', label: 'Wykonana praca' },
  { id: 'discount', label: 'Rabat' },
  { id: 'rate-source', label: 'Źródło stawki wykonawcy' },
  { id: 'rate-ceiling', label: 'Sufit stawki wykonawcy' },
  { id: 'note', label: 'Komentarz' },
] as const

export type FilterGroupIdT = (typeof FILTER_GROUPS)[number]['id']
