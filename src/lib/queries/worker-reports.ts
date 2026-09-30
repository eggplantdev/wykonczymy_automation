'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import {
  countPendingForInvestment,
  listDecidableReports,
  listWorkerReports,
  readWorkerReport,
  type ReportListRowT,
  type WorkerReportLineRowT,
  type WorkerReportRowT,
} from '@/lib/db/worker-reports'
import type {
  ReportLineT,
  WorkerReportSummaryT,
  WorkerReportT,
} from '@/lib/kosztorys/worker-report/types'

// Uncached: the dialog opens on a report someone may have decided a second ago in another window.
async function managementDb() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)
  return getDb(await getPayload({ config }))
}

export async function listInvestmentReports(investmentId: number): Promise<WorkerReportSummaryT[]> {
  const db = await managementDb()
  return (await listWorkerReports(db, investmentId)).map(toSummary)
}

export async function readInvestmentReport(
  investmentId: number,
  reportId: number,
): Promise<WorkerReportT | undefined> {
  const db = await managementDb()
  const found = await readWorkerReport(db, investmentId, reportId)
  if (!found) return undefined
  return { ...toSummary(found.report), lines: found.lines.map(toLine) }
}

export async function listAllReports(): Promise<ReportListRowT[]> {
  return listDecidableReports(await managementDb())
}

export async function countInvestmentPendingReports(investmentId: number): Promise<number> {
  return countPendingForInvestment(await managementDb(), investmentId)
}

function toSummary(row: WorkerReportRowT): WorkerReportSummaryT {
  return {
    id: row.id,
    investmentId: row.investmentId,
    workerId: row.workerId,
    workerName: row.workerName,
    sentAt: row.sentAt,
    status: row.status,
    decidedAt: row.decidedAt ?? undefined,
    decidedBy: row.decidedByName ?? undefined,
    target:
      row.targetStageOrdinal === null
        ? undefined
        : {
            stageId: row.targetStageId ?? undefined,
            ordinal: row.targetStageOrdinal,
            label: row.targetStageLabel ?? undefined,
          },
    lineCount: row.lineCount,
    acceptedLineCount: row.acceptedLineCount,
  }
}

function toLine(row: WorkerReportLineRowT): ReportLineT {
  return {
    id: row.id,
    kind: row.kind,
    itemId: row.itemId ?? undefined,
    description: row.description,
    unit: row.unit,
    sectionName: row.sectionName ?? undefined,
    reportedQty: row.reportedQty,
    acceptedQty: row.acceptedQty ?? undefined,
    createdItemId: row.createdItemId ?? undefined,
    catalogueItemId: row.catalogueItemId ?? undefined,
  }
}
