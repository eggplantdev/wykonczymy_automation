// A row of legacy-items.tsv carries this prefix on its investment id, so the report can tell an
// old Google sheet from a kosztorys kept in the app.
export const LEGACY_SOURCE_PREFIX = 'arkusz:'

export const isLegacySource = (source: string) => source.startsWith(LEGACY_SOURCE_PREFIX)
export const investmentOf = (source: string) =>
  isLegacySource(source) ? source.slice(LEGACY_SOURCE_PREFIX.length) : source
