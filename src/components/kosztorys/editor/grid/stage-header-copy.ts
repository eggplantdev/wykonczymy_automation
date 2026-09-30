import { STAGE_SPLIT_NEEDS_PLANE } from '@/lib/kosztorys/stage-split'

export const STAGE_HEADER_COPY = {
  planeSectionLabel: 'Rozliczenie',
  splitAction: 'Pracownicy etapu…',
  workerUnassigned: 'Bez przypisania',
  searchPlaceholder: 'Szukaj pracownika...',
  searchEmpty: 'Nie znaleziono pracownika.',
  workerNeedsPlane: STAGE_SPLIT_NEEDS_PLANE,
  planeUnconfirmed:
    'Wybierz jak rozliczać etap — do tego czasu ilości w tej kolumnie są zablokowane, bo nie weszłyby do rachunku żadnej ekipy.',
  renameAction: 'Zmień nazwę',
  removeAction: 'Usuń etap',
  removeConfirm: {
    title: (label: string) => `Usunąć „${label}"?`,
    description: 'Kolumna etapu i wszystkie wpisane w niej ilości zostaną usunięte.',
    confirmLabel: 'Usuń',
  },
} as const
