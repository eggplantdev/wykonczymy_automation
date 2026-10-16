import { pluralize } from '@/lib/utils/polish-plural'
import { itemNoun } from '@/lib/kosztorys/counted-nouns'

export const emptyReportReason = (catalogueSize: number) =>
  catalogueSize === 0
    ? 'Brak katalogu prac do porównania.'
    : 'Ten kosztorys nie ma jeszcze pozycji do porównania.'

export const matchingVerdict = (count: number) =>
  count === 0
    ? 'Żadna praca nie zgadza się z katalogiem co do wszystkich trzech liczb.'
    : `${count} ${itemNoun(count)} ma ceny i stawki zgodne z katalogiem.`

export const diffsVerdict = (count: number) =>
  count === 0
    ? 'Żadna praca z katalogu nie ma tu innych liczb.'
    : `${count} ${pluralize(count, ['praca różni się', 'prace różnią się', 'prac różni się'])} od katalogu ceną lub stawką.`

export const missingVerdict = (count: number) =>
  count === 0
    ? 'Każda praca z tego kosztorysu jest w katalogu.'
    : `${count} ${itemNoun(count)} spoza katalogu — nazwa albo jednostka nie ma tam odpowiednika.`
