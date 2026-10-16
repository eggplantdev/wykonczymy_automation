import { pluralize } from '@/lib/utils/polish-plural'

export const itemNoun = (count: number) => pluralize(count, ['praca', 'prace', 'prac'])

export const itemNounAccusative = (count: number) => pluralize(count, ['pracę', 'prace', 'prac'])

export const sectionNoun = (count: number) => pluralize(count, ['sekcja', 'sekcje', 'sekcji'])

export const itemHasPhrase = (count: number) =>
  pluralize(count, ['praca ma', 'prace mają', 'prac ma'])

export const itemNounLocative = (count: number) => pluralize(count, ['pracy', 'pracach', 'pracach'])

export const columnNoun = (count: number) => pluralize(count, ['kolumny', 'kolumn', 'kolumn'])

export const rateNoun = (count: number) => pluralize(count, ['stawka', 'stawki', 'stawek'])

export const rateNounDiffers = (count: number) =>
  pluralize(count, ['stawka różni się', 'stawki różnią się', 'stawek różni się'])

export const itemVanishesPhrase = (count: number) =>
  pluralize(count, ['praca zniknie', 'prace znikną', 'prac zniknie'])

export const activeFilterNarrowsPhrase = (count: number) =>
  pluralize(count, ['filtr zawęża', 'filtry zawężają', 'filtrów zawęża'])

export const differenceNoun = (count: number) => pluralize(count, ['różnica', 'różnice', 'różnic'])
