import type { MessageKeyT } from '@/lib/i18n/translations'

export const REPORT_STATUSES = ['pending', 'accepted', 'rejected'] as const

export type ReportStatusT = (typeof REPORT_STATUSES)[number]

export const isReportStatus = (value: string): value is ReportStatusT =>
  (REPORT_STATUSES as readonly string[]).includes(value)

export const REPORT_STATUS_LABEL_KEYS: Record<ReportStatusT, MessageKeyT<'workerReports'>> = {
  pending: 'statusPending',
  accepted: 'statusAccepted',
  rejected: 'statusRejected',
}
