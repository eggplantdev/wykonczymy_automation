import { sql } from '@payloadcms/db-vercel-postgres'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import type { DbExecutorT } from './get-db'
import { isoOrNull, numOrNull, text } from './row-coerce'

// Not `server-only`: the users collection's delete guard imports `countReportsByWorker`, and that
// graph also loads under `payload generate:types`, where `server-only` throws.

export type WorkerReportStatusT = 'pending' | 'accepted' | 'rejected'
export type WorkerReportLineKindT = 'rozpiska' | 'extra'

export type WorkerReportLineInputT = {
  kind: WorkerReportLineKindT
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
  status: WorkerReportStatusT
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
  kind: WorkerReportLineKindT
  itemId: number | null
  description: string
  unit: string
  sectionName: string | null
  reportedQty: number
  acceptedQty: number | null
  createdItemId: number | null
  catalogueItemId: number | null
}

export type PendingReportRowT = {
  id: number
  investmentId: number
  investmentName: string
  workerName: string
  sentAt: string
  lineCount: number
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
    status: row.status as WorkerReportStatusT,
    sentAt: isoOrNull(row.sent_at) ?? '',
    decidedAt: isoOrNull(row.decided_at),
    decidedByName: row.decided_by_name == null ? null : String(row.decided_by_name),
    targetStageId: numOrNull(row.target_stage_id),
    targetStageOrdinal: numOrNull(row.target_stage_ordinal),
    targetStageLabel: row.target_stage_label == null ? null : String(row.target_stage_label),
    lineCount: Number(row.line_count ?? 0),
    acceptedLineCount: Number(row.accepted_line_count ?? 0),
  }
}

function toLineRow(row: Record<string, unknown>): WorkerReportLineRowT {
  return {
    id: Number(row.id),
    position: Number(row.position),
    kind: row.kind as WorkerReportLineKindT,
    itemId: numOrNull(row.item_id),
    description: text(row.description),
    unit: text(row.unit),
    sectionName: row.section_name == null ? null : String(row.section_name),
    reportedQty: Number(row.reported_qty),
    acceptedQty: numOrNull(row.accepted_qty),
    createdItemId: numOrNull(row.created_item_id),
    catalogueItemId: numOrNull(row.catalogue_item_id),
  }
}

export type ReportShareT = {
  investmentId: number
  investmentName: string
  workerId: number
  workerName: string
  isWorkerActive: boolean
}

/**
 * The report link's token check. Deliberately blind to the investment's status and trash: the page
 * explains a zakończona or trashed investment instead of 404ing, and the gate refuses its writes.
 */
export async function readReportShare(
  db: DbExecutorT,
  token: string,
): Promise<ReportShareT | null> {
  if (!token) return null
  const res = await db.execute(sql`
    SELECT s.investment_id, i.name AS investment_name, s.worker_id, w.name AS worker_name,
      w.active AS worker_active
    FROM worker_report_shares s
    JOIN investments i ON i.id = s.investment_id
    JOIN users w ON w.id = s.worker_id
    WHERE s.token = ${token}
  `)
  const row = res.rows[0]
  if (!row) return null
  return {
    investmentId: Number(row.investment_id),
    investmentName: text(row.investment_name),
    workerId: Number(row.worker_id),
    workerName: text(row.worker_name),
    // A NULL predates the column's default; Payload reads it as active too.
    isWorkerActive: row.worker_active !== false,
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
): Promise<WorkerReportRowT[]> {
  const res = await db.execute(sql`
    SELECT ${REPORT_COLUMNS} FROM worker_reports r ${REPORT_JOINS}
    WHERE r.investment_id = ${investmentId}
    ORDER BY r.sent_at DESC, r.id DESC
  `)
  return res.rows.map(toReportRow)
}

export async function listWorkerReportsForWorker(
  db: DbExecutorT,
  investmentId: number,
  workerId: number,
): Promise<WorkerReportRowT[]> {
  const res = await db.execute(sql`
    SELECT ${REPORT_COLUMNS} FROM worker_reports r ${REPORT_JOINS}
    WHERE r.investment_id = ${investmentId} AND r.worker_id = ${workerId}
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
      accepted_qty, created_item_id, catalogue_item_id
    FROM worker_report_lines WHERE report_id = ${reportId}
    ORDER BY position
  `)
  return { report: toReportRow(row), lines: linesRes.rows.map(toLineRow) }
}

/** Every pending report the kierownik can still decide, oldest first — the queue, not a history. */
export async function listPendingReports(db: DbExecutorT): Promise<PendingReportRowT[]> {
  const res = await db.execute(sql`
    SELECT r.id, r.investment_id, i.name AS investment_name, w.name AS worker_name, r.sent_at,
      (SELECT count(*)::int FROM worker_report_lines l WHERE l.report_id = r.id) AS line_count
    FROM worker_reports r
    JOIN investments i ON i.id = r.investment_id
    JOIN users w ON w.id = r.worker_id
    WHERE r.status = 'pending' AND ${DECIDABLE_INVESTMENT}
    ORDER BY r.sent_at, r.id
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    investmentId: Number(row.investment_id),
    investmentName: text(row.investment_name),
    workerName: text(row.worker_name),
    sentAt: isoOrNull(row.sent_at) ?? '',
    lineCount: Number(row.line_count ?? 0),
  }))
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

/** What this worker already reported and nobody has decided yet, per pozycja — the form's „Zgłoszono". */
export async function pendingQtyByItem(
  db: DbExecutorT,
  investmentId: number,
  workerId: number,
): Promise<Map<number, number>> {
  const res = await db.execute(sql`
    SELECT l.item_id, sum(l.reported_qty) AS qty
    FROM worker_report_lines l
    JOIN worker_reports r ON r.id = l.report_id
    WHERE r.investment_id = ${investmentId} AND r.worker_id = ${workerId}
      AND r.status = 'pending' AND l.item_id IS NOT NULL
    GROUP BY l.item_id
  `)
  return new Map(res.rows.map((row) => [Number(row.item_id), Number(row.qty)]))
}

/**
 * The decision's single write: only a still-pending report moves, so a second click — or a second
 * kierownik — gets `null` and changes nothing. Returns the reporting worker.
 */
export async function claimPendingReport(
  db: DbExecutorT,
  investmentId: number,
  reportId: number,
  status: Exclude<WorkerReportStatusT, 'pending'>,
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

export type ReportLineDecisionT = {
  lineId: number
  acceptedQty: number
  // Set only for a line re-pointed to a pozycja (#14) or turned into one (an extra).
  itemId?: number
  createdItemId?: number
  catalogueItemId?: number
}

/** Lines left out of `decisions` stay `accepted_qty = NULL` — on a decided report, a rejected line. */
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
      created_item_id = v.created_item_id,
      catalogue_item_id = COALESCE(v.catalogue_item_id, l.catalogue_item_id)
    FROM (VALUES ${sql.join(values, sql.raw(', '))})
      AS v(line_id, accepted_qty, item_id, created_item_id, catalogue_item_id)
    WHERE l.id = v.line_id AND l.report_id = ${reportId}
  `)
}

/** Ordinal and label are copied: a later rename or delete of the etap must not rewrite the record. */
export async function setReportTarget(
  db: DbExecutorT,
  reportId: number,
  stage: { id: number; ordinal: number; label: string | null },
): Promise<void> {
  await db.execute(sql`
    UPDATE worker_reports
    SET target_stage_id = ${stage.id}, target_stage_ordinal = ${stage.ordinal},
      target_stage_label = ${stage.label}
    WHERE id = ${reportId}
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
