// TanStack's `alphanumeric` compares code points, which throws „Ł" and „Ś" past „Z".
export const compareDescriptions = (first: string, second: string) =>
  first.localeCompare(second, 'pl')
