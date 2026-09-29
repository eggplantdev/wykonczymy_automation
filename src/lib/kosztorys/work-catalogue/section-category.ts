// A sekcja is named per room instance („Łazienka 1", „Łazienka 2"); the cennik is global, so the

// instance number is noise. Only a TRAILING standalone number goes — „Gniazdka 230V" keeps its.
const TRAILING_ORDINAL = /\s+\d+$/

/** How a sekcja name becomes a kategoria — shared by both routes into the cennik. */
export function stripSectionOrdinal(name: string): string {
  return name.replace(TRAILING_ORDINAL, '').trim()
}
