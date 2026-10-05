export const REPORT_STATUSES = ['pending', 'accepted', 'rejected'] as const

export type ReportStatusT = (typeof REPORT_STATUSES)[number]

export const isReportStatus = (value: string): value is ReportStatusT =>
  (REPORT_STATUSES as readonly string[]).includes(value)

export const REPORT_STATUS_LABELS: Record<ReportStatusT, string> = {
  pending: 'Do sprawdzenia',
  accepted: 'Przyjęte',
  rejected: 'Odrzucone',
}
