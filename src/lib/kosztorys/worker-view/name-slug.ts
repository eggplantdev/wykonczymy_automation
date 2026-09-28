// `normalize('NFD')` splits „ó" into „o" plus a combining mark, but „ł" has no decomposition.
const UNDECOMPOSED: Record<string, string> = { ł: 'l', Ł: 'L' }

/**
 * The worker's name as it reads in a URL — the owner wants to tell links apart by who they are
 * for. Decoration only: the id or token beside it is what resolves, so a renamed worker's old
 * link keeps working.
 */
export function workerNameSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[łŁ]/g, (letter) => UNDECOMPOSED[letter])
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function workerPreviewSegment(name: string, workerId: number): string {
  const slug = workerNameSlug(name)
  return slug ? `${slug}-${workerId}` : String(workerId)
}

export function workerIdFromSegment(segment: string): number | undefined {
  const match = /(?:^|-)(\d+)$/.exec(segment)
  const workerId = match ? Number(match[1]) : NaN
  return Number.isSafeInteger(workerId) && workerId > 0 ? workerId : undefined
}

export function workerShareUrl(origin: string, name: string, token: string): string {
  const slug = workerNameSlug(name)
  return slug ? `${origin}/p/${slug}/${token}` : `${origin}/p/-/${token}`
}
