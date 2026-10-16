// Temporary: Delete this whole axis once the owner calls the comparison over.
export const STATS_VERSION_PARAM = 'widok'

export type StatsVersionT = 'v1' | 'v2'

export const STATS_VERSION_DEFAULT: StatsVersionT = 'v2'

export function parseStatsVersion(raw: string | string[] | undefined): StatsVersionT {
  return raw === 'v1' ? 'v1' : STATS_VERSION_DEFAULT
}
