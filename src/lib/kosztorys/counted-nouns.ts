import { pluralize } from '@/lib/utils/polish-plural'

// Shared so „5 prac" never becomes „5 pozycji" one screen over — the editor's reports are read one
// after the other, and a changed word reads as a changed thing.

export const itemNoun = (count: number) => pluralize(count, ['praca', 'prace', 'prac'])

export const sectionNoun = (count: number) => pluralize(count, ['sekcja', 'sekcje', 'sekcji'])

export const itemHasPhrase = (count: number) =>
  pluralize(count, ['praca ma', 'prace mają', 'prac ma'])

// Locative — „w 1 pracy", „w 2 pracach", „w 5 pracach". The nominative forms above read wrong after „w".
export const itemNounLocative = (count: number) => pluralize(count, ['pracy', 'pracach', 'pracach'])

export const columnNoun = (count: number) => pluralize(count, ['kolumny', 'kolumn', 'kolumn'])

export const rateNoun = (count: number) => pluralize(count, ['stawka', 'stawki', 'stawek'])

export const rateNounDiffers = (count: number) =>
  pluralize(count, ['stawka różni się', 'stawki różnią się', 'stawek różni się'])

export const itemVanishesPhrase = (count: number) =>
  pluralize(count, ['praca zniknie', 'prace znikną', 'prac zniknie'])

export const activeFilterHidesPhrase = (count: number) =>
  pluralize(count, ['włączony filtr chowa', 'włączone filtry chowają', 'włączonych filtrów chowa'])

export const differenceNoun = (count: number) => pluralize(count, ['różnica', 'różnice', 'różnic'])
