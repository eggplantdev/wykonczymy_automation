import { sql } from '@payloadcms/db-vercel-postgres'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { REPORT_STATUSES, type ReportStatusT } from '@/lib/kosztorys/worker-report/report-status'
import {
  isServerSortableReportColumn,
  type ServerSortableReportColumnT,
} from '@/lib/kosztorys/worker-report/sortable-columns'
import type { ReportLineKindT } from '@/lib/kosztorys/worker-report/types'
import { sortParamColumnId } from '@/lib/table/sort-param'
import type { DateRangeT } from '@/lib/utils/date-range'
import type { PaginationParamsT } from '@/lib/utils/pagination'
import type { ReferenceItemT } from '@/types/reference-data'
import type { DbExecutorT } from './get-db'
import { inList, sqlList, type SqlT } from './sql-list'
import { warsawDayWithin } from './sql-warsaw-day'
import { isoOrNull, numOrNull, text, textOrNull } from './row-coerce'

// Not `server-only`: the users collection's delete guard imports `countReportsByWorker`, and that
// graph also loads under `payload generate:types`, where `server-only` throws.

export type WorkerReportLineInputT = {
  kind: ReportLineKindT
  itemId: number | null
  description: string
  unit: string
  sectionName: string | null
  reportedQty: number
}

export type WorkerReportRowT = {
  id: number
  investmentId: number
  workerId: number
  workerName: string
  status: ReportStatusT
  sentAt: string
  decidedAt: string | null
  decidedByName: string | null
  targetStageId: number | null
  targetStageOrdinal: number | null
  targetStageLabel: string | null
  lineCount: number
  acceptedLineCount: number
}

export type WorkerReportLineRowT = {
  id: number
  position: number
  kind: ReportLineKindT
  itemId: number | null
  description: string
  unit: string
  sectionName: string | null
  reportedQty: number
  acceptedQty: number | null
  createdItemId: number | null
  catalogueItemId: number | null
  polishDescription: string | null
  descriptionLanguage: string | null
}

export type ReportListRowT = {
  id: number
  investmentId: number
  investmentName: string
  workerName: string
  status: ReportStatusT
  sentAt: string
  lineCount: number
  acceptedLineCount: number
}

// A report on a zakończona or trashed investment can be neither accepted nor rejected — the gate
// refuses both — so counting it would pin the badge above zero until someone reopens the investment.
const DECIDABLE_INVESTMENT = sql`i.trashed_at IS NULL AND i.status <> ${LOCKED_INVESTMENT_STATUS}`

const REPORT_COLUMNS = sql`
  r.id, r.investment_id, r.worker_id, w.name AS worker_name, r.status, r.sent_at, r.decided_at,
  d.name AS decided_by_name, r.target_stage_id, r.target_stage_ordinal, r.target_stage_label,
  (SELECT count(*)::int FROM worker_report_lines l WHERE l.report_id = r.id) AS line_count,
  (SELECT count(*)::int FROM worker_report_lines l
    WHERE l.report_id = r.id AND l.accepted_qty IS NOT NULL) AS accepted_line_count
`

const REPORT_JOINS = sql`
  JOIN users w ON w.id = r.worker_id
  LEFT JOIN users d ON d.id = r.decided_by
`

function toReportRow(row: Record<string, unknown>): WorkerReportRowT {
  return {
    id: Number(row.id),
    investmentId: Number(row.investment_id),
    workerId: Number(row.worker_id),
    workerName: text(row.worker_name),
    status: row.status as ReportStatusT,
    sentAt: isoOrNull(row.sent_at) ?? '',
    decidedAt: isoOrNull(row.decided_at),
    decidedByName: textOrNull(row.decided_by_name),
    targetStageId: numOrNull(row.target_stage_id),
    targetStageOrdinal: numOrNull(row.target_stage_ordinal),
    targetStageLabel: textOrNull(row.target_stage_label),
    lineCount: Number(row.line_count ?? 0),
    acceptedLineCount: Number(row.accepted_line_count ?? 0),
  }
}

function toLineRow(row: Record<string, unknown>): WorkerReportLineRowT {
  return {
    id: Number(row.id),
    position: Number(row.position),
    kind: row.kind as ReportLineKindT,
    itemId: numOrNull(row.item_id),
    description: text(row.description),
    unit: text(row.unit),
    sectionName: textOrNull(row.section_name),
    reportedQty: Number(row.reported_qty),
    acceptedQty: numOrNull(row.accepted_qty),
    createdItemId: numOrNull(row.created_item_id),
    catalogueItemId: numOrNull(row.catalogue_item_id),
    polishDescription: textOrNull(row.polish_description),
    descriptionLanguage: textOrNull(row.description_language),
  }
}

/** The report and its lines in one statement, so a send can never store a report without lines. */
export async function insertWorkerReport(
  db: DbExecutorT,
  report: { investmentId: number; workerId: number; lines: WorkerReportLineInputT[] },
): Promise<number> {
  const values = report.lines.map(
    (line, position) => sql`(
      ${position}::int, ${line.kind}::text, ${line.itemId}::int, ${line.description}::text,
      ${line.unit}::varchar, ${line.sectionName}::varchar, ${line.reportedQty}::numeric
    )`,
  )
  const res = await db.execute(sql`
    WITH report AS (
      INSERT INTO worker_reports (investment_id, worker_id)
      VALUES (${report.investmentId}, ${report.workerId})
      RETURNING id
    ), lines AS (
      INSERT INTO worker_report_lines
        (report_id, position, kind, item_id, description, unit, section_name, reported_qty)
      SELECT report.id, v.position, v.kind, v.item_id, v.description, v.unit, v.section_name, v.qty
      FROM report, (VALUES ${sql.join(values, sql.raw(', '))})
        AS v(position, kind, item_id, description, unit, section_name, qty)
    )
    SELECT id FROM report
  `)
  return Number(res.rows[0]?.id)
}

export async function listWorkerReports(
  db: DbExecutorT,
  investmentId: number,
  workerId?: number,
): Promise<WorkerReportRowT[]> {
  const res = await db.execute(sql`
    SELECT ${REPORT_COLUMNS} FROM worker_reports r ${REPORT_JOINS}
    WHERE r.investment_id = ${investmentId}
      ${workerId === undefined ? sql`` : sql`AND r.worker_id = ${workerId}`}
    ORDER BY r.sent_at DESC, r.id DESC
  `)
  return res.rows.map(toReportRow)
}

/** Scoped by the investment as well as the id: a report id alone would let one editor read another's. */
export async function readWorkerReport(
  db: DbExecutorT,
  investmentId: number,
  reportId: number,
): Promise<{ report: WorkerReportRowT; lines: WorkerReportLineRowT[] } | null> {
  const reportRes = await db.execute(sql`
    SELECT ${REPORT_COLUMNS} FROM worker_reports r ${REPORT_JOINS}
    WHERE r.id = ${reportId} AND r.investment_id = ${investmentId}
  `)
  const row = reportRes.rows[0]
  if (!row) return null

  const linesRes = await db.execute(sql`
    SELECT id, position, kind, item_id, description, unit, section_name, reported_qty,
      accepted_qty, created_item_id, catalogue_item_id, polish_description, description_language
    FROM worker_report_lines WHERE report_id = ${reportId}
    ORDER BY position
  `)
  return { report: toReportRow(row), lines: linesRes.rows.map(toLineRow) }
}

/** `null` leaves a dimension unfiltered; an empty list matches nothing (the URL named no valid value). */
export type WorkerReportFiltersT = {
  statuses: ReportStatusT[] | null
  investmentIds: number[] | null
  workerIds: number[] | null
  sentRange: DateRangeT
}

function decidableReportsWhere(filters: WorkerReportFiltersT): SqlT {
  const conditions = [
    DECIDABLE_INVESTMENT,
    inList(sql`r.status`, filters.statuses),
    inList(sql`r.investment_id`, filters.investmentIds),
    inList(sql`r.worker_id`, filters.workerIds),
    ...warsawDayWithin(sql`r.sent_at`, filters.sentRange),
  ].filter((condition) => condition !== undefined)
  return sql.join(conditions, sql.raw(' AND '))
}

const QUEUE_ORDER = sql`r.status <> 'pending', r.sent_at DESC, r.id DESC`

const SORT_EXPRESSIONS: Record<ServerSortableReportColumnT, SqlT> = {
  investmentName: sql`i.name`,
  workerName: sql`w.name`,
  sentAt: sql`r.sent_at`,
  lineCount: sql`line_count`,
  // Queue order rather than alphabetical, which would put „Przyjęte" ahead of „Do sprawdzenia".
  status: sql`array_position(ARRAY[${sqlList(REPORT_STATUSES)}]::text[], r.status)`,
}

// The column picks a SQL fragment rather than a bound value, so an unknown one falls back to the queue
// here too. Ties stay newest first whichever way the column runs.
function reportsOrderBy(sort: string | undefined): SqlT {
  if (!sort) return QUEUE_ORDER
  const column = sortParamColumnId(sort)
  if (!isServerSortableReportColumn(column)) return QUEUE_ORDER
  const direction = sql.raw(sort.startsWith('-') ? 'DESC' : 'ASC')
  return sql`${SORT_EXPRESSIONS[column]} ${direction}, r.sent_at DESC, r.id DESC`
}

/**
 * Every report the kierownik can still act on — a decided one too, since its open lines stay
 * acceptable. Without a `sort`, the pending queue first, then the rest newest first.
 */
export async function listDecidableReports(
  db: DbExecutorT,
  filters: WorkerReportFiltersT,
  { page, limit }: PaginationParamsT,
  sort?: string,
): Promise<{ rows: ReportListRowT[]; totalDocs: number }> {
  const where = decidableReportsWhere(filters)
  const [res, countRes] = await Promise.all([
    db.execute(sql`
      SELECT ${REPORT_COLUMNS}, i.name AS investment_name
      FROM worker_reports r ${REPORT_JOINS}
      JOIN investments i ON i.id = r.investment_id
      WHERE ${where}
      ORDER BY ${reportsOrderBy(sort)}
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `),
    db.execute(sql`
      SELECT count(*)::int AS total
      FROM worker_reports r JOIN investments i ON i.id = r.investment_id
      WHERE ${where}
    `),
  ])
  const rows = res.rows.map((row) => {
    const report = toReportRow(row)
    return {
      id: report.id,
      investmentId: report.investmentId,
      investmentName: text(row.investment_name),
      workerName: report.workerName,
      status: report.status,
      sentAt: report.sentAt,
      lineCount: report.lineCount,
      acceptedLineCount: report.acceptedLineCount,
    }
  })
  return { rows, totalDocs: Number(countRes.rows[0]?.total ?? 0) }
}

/**
 * Only investments and workers that have a report on this list — an option outside it could only
 * ever filter down to nothing, which is the case for every zakończona inwestycja.
 */
export async function listReportFilterOptions(
  db: DbExecutorT,
): Promise<{ investments: ReferenceItemT[]; workers: ReferenceItemT[] }> {
  const [investmentsRes, workersRes] = await Promise.all([
    db.execute(sql`
      SELECT DISTINCT i.id, i.name
      FROM worker_reports r JOIN investments i ON i.id = r.investment_id
      WHERE ${DECIDABLE_INVESTMENT}
      ORDER BY i.name
    `),
    db.execute(sql`
      SELECT DISTINCT w.id, w.name
      FROM worker_reports r JOIN investments i ON i.id = r.investment_id
      JOIN users w ON w.id = r.worker_id
      WHERE ${DECIDABLE_INVESTMENT}
      ORDER BY w.name
    `),
  ])
  const toItem = (row: Record<string, unknown>) => ({ id: Number(row.id), name: text(row.name) })
  return { investments: investmentsRes.rows.map(toItem), workers: workersRes.rows.map(toItem) }
}

export async function countPendingReports(db: DbExecutorT): Promise<number> {
  const res = await db.execute(sql`
    SELECT count(*)::int AS total
    FROM worker_reports r JOIN investments i ON i.id = r.investment_id
    WHERE r.status = 'pending' AND ${DECIDABLE_INVESTMENT}
  `)
  return Number(res.rows[0]?.total ?? 0)
}

export async function countPendingForInvestment(
  db: DbExecutorT,
  investmentId: number,
): Promise<number> {
  const res = await db.execute(sql`
    SELECT count(*)::int AS total FROM worker_reports
    WHERE investment_id = ${investmentId} AND status = 'pending'
  `)
  return Number(res.rows[0]?.total ?? 0)
}

/**
 * The decision's single write: only a still-pending report moves, so a second click — or a second
 * kierownik — gets `null` and changes nothing. Returns the reporting worker.
 */
export async function claimPendingReport(
  db: DbExecutorT,
  investmentId: number,
  reportId: number,
  status: Exclude<ReportStatusT, 'pending'>,
  userId: number,
): Promise<number | null> {
  const res = await db.execute(sql`
    UPDATE worker_reports
    SET status = ${status}, decided_at = now(), decided_by = ${userId}
    WHERE id = ${reportId} AND investment_id = ${investmentId} AND status = 'pending'
    RETURNING worker_id
  `)
  const row = res.rows[0]
  return row ? Number(row.worker_id) : null
}

/**
 * Whatever the report's status: a line odrzucona — or a whole report odrzucone — can still be
 * przyjęta later. Two accepts of one report are serialised by the investment row lock the caller
 * holds (`lockInvestmentGates`), not by this UPDATE. The etap's ordinal and label are copied, so a
 * later rename or delete of it does not rewrite the record; without one the record stays as it was.
 */
export async function markReportAccepted(
  db: DbExecutorT,
  reportId: number,
  userId: number,
  stage: { id: number; ordinal: number; label: string | null } | undefined,
): Promise<void> {
  const target = stage
    ? sql`, target_stage_id = ${stage.id}, target_stage_ordinal = ${stage.ordinal},
        target_stage_label = ${stage.label}`
    : sql``
  await db.execute(sql`
    UPDATE worker_reports
    SET status = 'accepted', decided_at = now(), decided_by = ${userId} ${target}
    WHERE id = ${reportId}
  `)
}

/**
 * An undone praca spoza rozpiski is left pointing at the pozycja its accept created, so accepting it
 * again adds to that pozycja instead of minting a second one.
 */
export async function clearLinesAcceptance(
  db: DbExecutorT,
  reportId: number,
  lineIds: number[],
): Promise<void> {
  if (lineIds.length === 0) return
  await db.execute(sql`
    UPDATE worker_report_lines
    SET accepted_qty = NULL, item_id = COALESCE(created_item_id, item_id), created_item_id = NULL,
      catalogue_item_id = NULL
    WHERE id IN (${sqlList(lineIds)}) AND report_id = ${reportId}
  `)
}

// Undecided again once nothing of it is accepted: back in the queue, free to go to any etap.
export async function reopenReportIfNoneAccepted(db: DbExecutorT, reportId: number): Promise<void> {
  await db.execute(sql`
    UPDATE worker_reports
    SET status = 'pending', decided_at = NULL, decided_by = NULL, target_stage_id = NULL,
      target_stage_ordinal = NULL, target_stage_label = NULL
    WHERE id = ${reportId} AND NOT EXISTS (
      SELECT 1 FROM worker_report_lines l WHERE l.report_id = ${reportId} AND l.accepted_qty IS NOT NULL
    )
  `)
}

export type ReportLineDecisionT = {
  lineId: number
  acceptedQty: number
  // Set only for a line re-pointed to a pozycja or turned into one (an extra).
  itemId?: number
  createdItemId?: number
  catalogueItemId?: number
}

/** Lines left out of `decisions` stay `accepted_qty = NULL`. */
export async function updateReportLines(
  db: DbExecutorT,
  reportId: number,
  decisions: ReportLineDecisionT[],
): Promise<void> {
  if (decisions.length === 0) return
  const values = decisions.map(
    (decision) => sql`(
      ${decision.lineId}::int, ${decision.acceptedQty}::numeric, ${decision.itemId ?? null}::int,
      ${decision.createdItemId ?? null}::int, ${decision.catalogueItemId ?? null}::int
    )`,
  )
  await db.execute(sql`
    UPDATE worker_report_lines l
    SET accepted_qty = v.accepted_qty,
      item_id = COALESCE(v.item_id, l.item_id),
      created_item_id = COALESCE(v.created_item_id, l.created_item_id),
      catalogue_item_id = COALESCE(v.catalogue_item_id, l.catalogue_item_id)
    FROM (VALUES ${sql.join(values, sql.raw(', '))})
      AS v(line_id, accepted_qty, item_id, created_item_id, catalogue_item_id)
    WHERE l.id = v.line_id AND l.report_id = ${reportId}
  `)
}

export async function countReportsByWorker(
  db: DbExecutorT,
  workerId: string | number,
): Promise<number> {
  const { rows } = await db.execute(sql`
    SELECT count(*)::int AS total FROM worker_reports WHERE worker_id = ${Number(workerId)}
  `)
  return Number(rows[0]?.total ?? 0)
}
