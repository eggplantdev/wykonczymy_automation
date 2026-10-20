export const SHOWCASE_SECTIONS = [
  { id: 'colors', label: 'Kolory' },
  { id: 'typography', label: 'Typografia' },
  { id: 'radius-shadow', label: 'Zaokrąglenia i cienie' },
  { id: 'badges', label: 'Badge' },
  { id: 'buttons', label: 'Przyciski' },
  { id: 'fields', label: 'Pola formularzy' },
  { id: 'overlays', label: 'Nakładki' },
  { id: 'dialogs', label: 'Dialogi' },
  { id: 'feedback', label: 'Ładowanie i stany' },
  { id: 'layout', label: 'Bloki układu' },
  { id: 'navigation', label: 'Nawigacja' },
  { id: 'data-display', label: 'Prezentacja danych' },
] as const

export type ShowcaseSectionIdT = (typeof SHOWCASE_SECTIONS)[number]['id']
