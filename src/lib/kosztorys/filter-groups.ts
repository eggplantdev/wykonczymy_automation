import { planeDashSuffix } from '@/lib/kosztorys/format'

// Each group must split the pozycje into options that never overlap and leave none out: then ticking
// the rest of a group reaches whatever unticking one option used to.
export const FILTER_GROUPS = [
  { id: 'ai-review', label: 'Przegląd AI' },
  { id: 'planned', label: 'Przedmiar' },
  { id: 'measured', label: 'Wykonana praca' },
  { id: 'filled', label: 'Puste pozycje' },
  { id: 'rate-source-w-tools', label: 'Źródło stawki wykonawcy' + planeDashSuffix('w_tools') },
  { id: 'rate-source-own-tools', label: 'Źródło stawki wykonawcy' + planeDashSuffix('own_tools') },
  { id: 'rate-ceiling-w-tools', label: 'Udział wykonawcy w cenie' + planeDashSuffix('w_tools') },
  { id: 'rate-ceiling-own-tools', label: 'Udział wykonawcy w cenie' + planeDashSuffix('own_tools') },
  { id: 'note', label: 'Komentarz' },
  { id: 'discount', label: 'Rabat' },
] as const

export type FilterGroupIdT = (typeof FILTER_GROUPS)[number]['id']
