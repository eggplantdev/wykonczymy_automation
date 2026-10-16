import { PLANE_LABELS } from '@/lib/kosztorys/labels'

export const PROBLEM_GROUPS = [
  { id: 'client-price', label: 'Ceny dla klienta' },
  {
    id: 'subcontractor-rate-w-tools',
    label: `Stawki wykonawców — ${PLANE_LABELS.w_tools.toLowerCase()}`,
  },
  {
    id: 'subcontractor-rate-own-tools',
    label: `Stawki wykonawców — ${PLANE_LABELS.own_tools.toLowerCase()}`,
  },
  { id: 'scope-stages', label: 'Przedmiar i etapy' },
  { id: 'catalogue', label: 'Katalog prac' },
  { id: 'translations', label: 'Tłumaczenia' },
  { id: 'ai-review', label: 'Przegląd AI' },
] as const

export type ProblemGroupIdT = (typeof PROBLEM_GROUPS)[number]['id']
