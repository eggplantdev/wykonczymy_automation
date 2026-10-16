// Only a TRAILING standalone number goes — „Gniazdka 230V" keeps its.
const TRAILING_ORDINAL = /\s+\d+$/

export function stripSectionOrdinal(name: string): string {
  return name.replace(TRAILING_ORDINAL, '').trim()
}
