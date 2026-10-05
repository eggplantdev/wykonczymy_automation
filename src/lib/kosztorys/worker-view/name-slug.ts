// `normalize('NFD')` splits „ó" into „o" plus a combining mark, but „ł" has no decomposition.
const UNDECOMPOSED: Record<string, string> = { ł: 'l', Ł: 'L' }

/**
 * A name as it reads in a URL — the owner wants to tell links apart by whom and which investment
 * they are for. Decoration only: the id or token beside it is what resolves, so a renamed worker's
 * or investment's old link keeps working.
 */
export function nameSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[łŁ]/g, (letter) => UNDECOMPOSED[letter])
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function workerPreviewSegment(name: string, workerId: number): string {
  const slug = nameSlug(name)
  return slug ? `${slug}-${workerId}` : String(workerId)
}

export function workerIdFromSegment(segment: string): number | undefined {
  const match = /(?:^|-)(\d+)$/.exec(segment)
  const workerId = match ? Number(match[1]) : NaN
  return Number.isSafeInteger(workerId) && workerId > 0 ? workerId : undefined
}

export function workerReportShareUrl(
  origin: string,
  investmentName: string,
  workerName: string,
  token: string,
): string {
  return `${origin}/z/${nameSlug(investmentName) || '-'}/${nameSlug(workerName) || '-'}/${token}`
}
