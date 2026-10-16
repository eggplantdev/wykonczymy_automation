// `normalize('NFD')` splits „ó" into „o" plus a combining mark, but „ł" has no decomposition.
const UNDECOMPOSED: Record<string, string> = { ł: 'l', Ł: 'L' }

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

const REPORT_VIEW_PARAM = 'view'
const SUMMARY_VIEW = 'summary'

export function summaryViewUrl(reportUrl: string): string {
  return `${reportUrl}?${REPORT_VIEW_PARAM}=${SUMMARY_VIEW}`
}

export function opensOnSummaryView(searchParams: URLSearchParams | null): boolean {
  return searchParams?.get(REPORT_VIEW_PARAM) === SUMMARY_VIEW
}

export function workerReportShareUrl(
  origin: string,
  investmentName: string,
  workerName: string,
  token: string,
): string {
  return `${origin}/z/${nameSlug(investmentName) || '-'}/${nameSlug(workerName) || '-'}/${token}`
}
