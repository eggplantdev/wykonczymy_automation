import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'

export type ReportFormItemT = {
  id: number
  description: string
  unit: string
}

export type ReportFormSectionT = {
  id: number
  name: string
  color: SectionColorKeyT | null
  items: ReportFormItemT[]
}

// Everything the form may show, and nothing else: no rates, no other crew's etapy.
export type WorkerReportFormDataT = {
  investmentId: number
  investmentName: string
  workerId: number
  workerName: string
  sections: ReportFormSectionT[]
  commonUnits: string[]
}

// His rozpiska grid as a report form. His etapy stay read-only; he types into one extra „Zgłaszam”
// column, and every edit lands in his draft instead of the server. Which etap it goes to is the
// kierownik's call at verification.
export type ReportModeT = {
  // What the draft already holds, so a reload reopens the column with his unsent work in it.
  initialQtyByItem: Record<number, number>
  pendingQtyByItem: Record<number, number>
  // Only Opis prac and „Zgłaszam” — the rest of the sheet is context he can switch back to.
  isCompact: boolean
  onReportQty: (itemId: number, qty: number) => void
}

// What the worker's browser sends: a rozpiska line names only its pozycja — opis, j.m. and sekcja are
// copied on the server from the live pozycja, never taken from the client.
export type SendReportLineT =
  | { kind: 'rozpiska'; itemId: number; qty: number }
  | { kind: 'extra'; description: string; unit: string; qty: number }

export type ReportLineKindT = 'rozpiska' | 'extra'

export type ReportStatusT = 'pending' | 'accepted' | 'rejected'

// Opis + j.m. are copied onto the line when it is sent, so a later rename or delete of the pozycja
// does not rewrite what the worker reported.
export type ReportLineT = {
  id: number
  kind: ReportLineKindT
  // Gone once its pozycja was deleted (a restore, „Wyczyść kosztorys") — the line is then re-pointed
  // by hand.
  itemId: number | undefined
  description: string
  unit: string
  sectionName: string | undefined
  reportedQty: number
  // Undefined on a pending report, and on a decided one for a line that was not accepted.
  acceptedQty: number | undefined
  createdItemId: number | undefined
  catalogueItemId: number | undefined
}

// Ordinal and label are copied, so a later rename or delete of the etap does not rewrite where the
// kierownik put it. `stageId` is gone once the etap was deleted.
export type ReportTargetT = {
  stageId: number | undefined
  ordinal: number
  label: string | undefined
}

export type WorkerReportSummaryT = {
  id: number
  investmentId: number
  workerId: number
  workerName: string
  sentAt: string
  status: ReportStatusT
  decidedAt: string | undefined
  decidedBy: string | undefined
  target: ReportTargetT | undefined
  lineCount: number
  acceptedLineCount: number
}

export type WorkerReportT = WorkerReportSummaryT & { lines: ReportLineT[] }

export type AcceptTargetT = { kind: 'stage'; stageId: number } | { kind: 'new'; plane?: ToolPlaneT }

export type AcceptReportInputT = {
  investmentId: number
  reportId: number
  target: AcceptTargetT
  // `itemId` only for a line re-pointed by hand after its pozycja was deleted.
  lines: { lineId: number; acceptedQty: number; itemId?: number }[]
  extras: {
    lineId: number
    acceptedQty: number
    sectionId: number
    clientPrice?: number
    catalogueItemId?: number
  }[]
}

export type AcceptReportResultT = {
  // Only when the report went to „Nowy etap".
  stage: KosztorysStageT | undefined
  appended: (KosztorysSectionT & { items: KosztorysItemT[] })[]
  // Absolute figures after the addition — the client never re-adds.
  cells: { itemId: number; stageId: number; qtyDone: number }[]
  revision: string
}
