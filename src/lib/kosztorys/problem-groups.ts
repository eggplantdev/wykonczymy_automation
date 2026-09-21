import { PLANE_LABELS } from '@/lib/kosztorys/constants'

/**
 * The headings the „Problemy" list is read under. Fifteen sentences in one column are read as one
 * undifferentiated pile; under four headings the reader picks the subject first and the row second —
 * the same arrangement the „Sekcje" menu uses for its own two kinds of row.
 *
 * Split by the part of the rozpiska a fix happens in, not by the gesture it takes. Every pick narrows
 * the grid and reveals that problem's own columns, so the heading promises where the reader is about
 * to land: „bez ceny j.m." and „bez ceny wykonawcy" are both a missing number, but they are two
 * different columns and two different conversations — one with the client, one with the ekipa.
 */
export const PROBLEM_GROUPS = [
  { id: 'client-price', label: 'Ceny dla klienta' },
  // Split by view, because a stawka only exists in one of them: a single „Stawki wykonawców" heading
  // put two crews' numbers in one block and made every row spell out which view it meant.
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
] as const

export type ProblemGroupIdT = (typeof PROBLEM_GROUPS)[number]['id']
