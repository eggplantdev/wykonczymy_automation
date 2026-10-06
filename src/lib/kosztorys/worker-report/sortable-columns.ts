export const SERVER_SORTABLE_REPORT_COLUMNS = [
  'investmentName',
  'workerName',
  'sentAt',
  'lineCount',
  'status',
] as const

export type ServerSortableReportColumnT = (typeof SERVER_SORTABLE_REPORT_COLUMNS)[number]

export function isServerSortableReportColumn(
  columnId: string,
): columnId is ServerSortableReportColumnT {
  return (SERVER_SORTABLE_REPORT_COLUMNS as readonly string[]).includes(columnId)
}
