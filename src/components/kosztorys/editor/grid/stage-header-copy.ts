export const STAGE_HEADER_COPY = {
  planeSectionLabel: 'Rozliczenie',
  splitAction: 'Pracownicy etapu…',
  workerUnassigned: 'Bez przypisania',
  workerUnknown: 'nieznana osoba',
  searchPlaceholder: 'Szukaj pracownika...',
  searchEmpty: 'Nie znaleziono pracownika.',
  workerNeedsPlane:
    'Najpierw wybierz rozliczenie etapu — bez niego etap nie ma ceny, więc nikomu nic nie nalicza.',
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
