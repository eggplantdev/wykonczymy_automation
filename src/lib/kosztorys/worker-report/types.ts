import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'

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

export type ReportLineKindT = 'rozpiska' | 'manual'

// Opis + j.m. are copied onto the line when it is sent, so a later rename or delete of the pozycja
// does not rewrite what the worker reported.
export type ReportLineT = {
  key: string
  kind: ReportLineKindT
  itemId: number | undefined
  description: string
  unit: string
  qty: number
  sectionName: string | undefined
}

export type ReportStatusT = 'pending' | 'accepted' | 'rejected'

export type LineDecisionT = {
  isAccepted: boolean
  // Set when the manager recognised a dopisana praca as a katalog wpis and swapped it in.
  catalogueId: number | undefined
  qty: number
  sectionId: number | undefined
  unitPrice: number | undefined
}

// The label is copied, so a later rename of the etap does not rewrite where the kierownik put it.
export type ReportTargetT = { kind: 'newStage' } | { kind: 'stage'; stageId: number; label: string }

export type WorkerReportT = {
  id: string
  investmentId: number
  workerId: number
  workerName: string
  sentAt: string
  status: ReportStatusT
  lines: ReportLineT[]
  decisions: Record<string, LineDecisionT> | undefined
  target: ReportTargetT | undefined
  decidedAt: string | undefined
}
