'use server'

import { managementDb } from '@/lib/queries/worker-reports-list'
import {
  listWorkerReports,
  readWorkerReport,
  type WorkerReportLineRowT,
  type WorkerReportRowT,
} from '@/lib/db/worker-reports'
import {
  listWorkersWithActiveStages,
  listWorkerStageInvestments,
  type ScanWorkerT,
  type WorkerStageInvestmentT,
} from '@/lib/db/stage-memberships'
import type {
  ReportLineT,
  WorkerReportSummaryT,
  WorkerReportT,
} from '@/lib/kosztorys/worker-report/types'

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
  return { ...toSummary(found.report), lines: found.lines.map(toLine), photos: found.media }
}

export async function readScanWorkers(): Promise<ScanWorkerT[]> {
  return listWorkersWithActiveStages(await managementDb())
}

export async function readScanWorkerInvestments(
  workerId: number,
): Promise<WorkerStageInvestmentT[]> {
  return listWorkerStageInvestments(await managementDb(), workerId)
}

function toSummary(row: WorkerReportRowT): WorkerReportSummaryT {
  return {
    id: row.id,
    investmentId: row.investmentId,
    workerId: row.workerId,
    workerName: row.workerName,
    workerLanguage: row.workerLanguage ?? undefined,
    source: row.source,
    createdByName: row.createdByName ?? undefined,
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
    polishDescription: row.polishDescription ?? undefined,
    descriptionLanguage: row.descriptionLanguage ?? undefined,
    isUncertain: row.isUncertain,
    scannedRef: row.scannedRef ?? undefined,
  }
}
