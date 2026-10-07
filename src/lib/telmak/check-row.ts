import { firstNoteLine } from '@/lib/utils/invoice-note'
import type { TelmakDocT } from '@/lib/telmak/parse-telmak'
import type { TelmakAppRowT, TelmakResultRowT, TelmakStatusT } from '@/lib/telmak/compare-telmak'
import type { PreviewFileT } from '@/types/media'

export type TelmakPackageFileT = { doc: TelmakDocT; file: File; preview: PreviewFileT }

export type TelmakCheckRowT = {
  status: TelmakStatusT
  rows: TelmakAppRowT[]
  document: string
  issueDate: string | null
  docAmount: number | null
  appAmount: number | null
  investmentName: string | null
  notes: string
  local: TelmakPackageFileT | null
  needsFile: TelmakAppRowT[]
}

export function toTelmakCheckRow(r: TelmakResultRowT, pkg: TelmakPackageFileT[]): TelmakCheckRowT {
  return {
    status: r.status,
    rows: r.rows,
    document: r.doc?.number ?? firstNoteLine(r.rows[0]?.invoiceNote) ?? '—',
    issueDate: r.doc?.date ?? null,
    docAmount: r.doc?.amount ?? null,
    appAmount: r.appAmount,
    investmentName: r.rows.find((row) => !row.cancelled)?.investmentName ?? null,
    notes: [...r.issues, r.doc?.remark && `uwagi na fakturze: ${r.doc.remark}`]
      .filter(Boolean)
      .join('; '),
    local: r.doc ? (pkg.find((p) => p.doc === r.doc) ?? null) : null,
    needsFile: r.needsFile,
  }
}

export function problemRowIds(results: TelmakResultRowT[]): number[] {
  return [
    ...new Set(
      results.filter((r) => r.status !== 'ok').flatMap((r) => r.rows.map((row) => row.id)),
    ),
  ]
}
