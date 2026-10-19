import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import {
  listReportLines,
  listReportMedia,
  listReportPreviewLines,
  readReportPreviewRow,
  readReportRow,
  type ReportPreviewReadT,
  type WorkerReportLineRowT,
  type WorkerReportRowT,
} from '@/lib/db/worker-reports'
import type { MediaFileT } from '@/types/media'

export async function readWorkerReport(
  db: DbExecutorT,
  investmentId: number,
  reportId: number,
): Promise<{
  report: WorkerReportRowT
  lines: WorkerReportLineRowT[]
  media: MediaFileT[]
} | null> {
  const report = await readReportRow(db, investmentId, reportId)
  if (!report) return null
  const [lines, media] = await Promise.all([
    listReportLines(db, reportId),
    listReportMedia(db, reportId),
  ])
  return { report, lines, media }
}

export async function readReportPreview(
  db: DbExecutorT,
  reportId: number,
  viewer: { id: number; isManagement: boolean },
): Promise<ReportPreviewReadT | null> {
  const report = await readReportPreviewRow(db, reportId, viewer)
  if (!report) return null
  const [lines, media] = await Promise.all([
    listReportPreviewLines(db, reportId),
    listReportMedia(db, reportId),
  ])
  return { report, lines, media }
}
