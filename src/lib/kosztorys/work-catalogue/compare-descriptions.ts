// Spelled out rather than left to TanStack's default: its `alphanumeric` compares code points, which
// throws „Ł" and „Ś" past „Z". Lives here because two surfaces must agree on it — the „Opis pracy"
// column sorts with it and Lp. numbers itself in the same order; the two disagreeing is exactly what
// made Lp. look random.
export const compareDescriptions = (first: string, second: string) =>
  first.localeCompare(second, 'pl')
