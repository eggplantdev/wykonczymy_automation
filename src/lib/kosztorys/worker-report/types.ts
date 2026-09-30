import type { z } from 'zod'
import type { StageProgressCellT } from '@/lib/db/stage-progress'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { acceptSchema, sendLineSchema } from '@/lib/kosztorys/worker-report/schemas'
import type { KosztorysItemT, KosztorysSectionT, KosztorysStageT } from '@/lib/kosztorys/types'

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

export type SendReportLineT = z.input<typeof sendLineSchema>

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

export type AcceptReportInputT = z.input<typeof acceptSchema>

export type AcceptTargetT = AcceptReportInputT['target']

export type AcceptReportResultT = {
  // Only when the report went to „Nowy etap".
  stage: KosztorysStageT | undefined
  appended: (KosztorysSectionT & { items: KosztorysItemT[] })[]
  // Absolute figures after the addition — the client never re-adds.
  cells: StageProgressCellT[]
  revision: string
}
