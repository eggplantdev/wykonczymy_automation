// `ł`/`Ł` is a distinct letter, not `l` + a combining accent, so NFD leaves it untouched — fold it
// explicitly, else a "lodz" query never matches „Łódź".
export const foldText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()

export const foldFilter = (value: string, search: string) =>
  foldText(value).includes(foldText(search)) ? 1 : 0
