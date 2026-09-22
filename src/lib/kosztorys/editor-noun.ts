// The same editor renders two things: a kosztorys on an inwestycja and a szablon in the warsztat.
// Every label that names the document has to say which one it is — a generic word („dokument",
// „rozpiska") would be wrong on both screens rather than right on neither.
//
// Two masculine inanimate nouns, so the accusative equals the nominative and only the genitive
// differs; a full declension table would be five copies of the same two words. A label that says
// something ELSE about the screen (that the szablon belongs to no inwestycja, that clearing it loses
// the etapy) is not a noun swap — rewrite that sentence per screen instead.
export type EditorNounT = {
  // Sentence-initial: „Szablon jest pusty".
  Nominative: string
  // Mid-sentence: „Wyczyść szablon…".
  nominative: string
  // „…ceny i stawki tego szablonu…".
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

export function editorNoun(templatePresetId: number | undefined): EditorNounT {
  return templatePresetId == null ? KOSZTORYS : SZABLON
}
