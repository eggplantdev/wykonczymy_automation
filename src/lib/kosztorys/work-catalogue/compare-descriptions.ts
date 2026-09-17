// TanStack's `alphanumeric` compares code points, which throws „Ł" and „Ś" past „Z". Shared because the
// „Opis pracy" column and Lp.'s numbering must agree — the two disagreeing is what made Lp. look random.
export const compareDescriptions = (first: string, second: string) =>
  first.localeCompare(second, 'pl')
