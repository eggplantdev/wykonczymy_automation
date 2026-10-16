export const FILTER_GROUPS = [
  { id: 'ai-review', label: 'Przegląd AI' },
  { id: 'quantities', label: 'Przedmiar i wykonana praca' },
  { id: 'rate-source', label: 'Źródło stawki wykonawcy' },
  { id: 'rate-ceiling', label: 'Udział wykonawcy w cenie' },
  { id: 'note', label: 'Komentarz' },
  { id: 'discount', label: 'Rabat' },
] as const

export type FilterGroupIdT = (typeof FILTER_GROUPS)[number]['id']
