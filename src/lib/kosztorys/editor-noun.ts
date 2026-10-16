export type EditorNounT = {
  Nominative: string
  nominative: string
  genitive: string
}

const KOSZTORYS: EditorNounT = {
  Nominative: 'Kosztorys',
  nominative: 'kosztorys',
  genitive: 'kosztorysu',
}

const SZABLON: EditorNounT = {
  Nominative: 'Szablon',
  nominative: 'szablon',
  genitive: 'szablonu',
}

export function editorNoun(isTemplate: boolean | undefined): EditorNounT {
  return isTemplate ? SZABLON : KOSZTORYS
}
