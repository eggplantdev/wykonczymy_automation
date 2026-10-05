import type { z } from 'zod'
import type { StageProgressCellT } from '@/lib/db/stage-progress'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type {
  acceptSchema,
  createScannedReportSchema,
  scanPageSchema,
  sendLineSchema,
} from '@/lib/kosztorys/worker-report/schemas'
import type { KosztorysItemT, KosztorysSectionT, KosztorysStageT } from '@/lib/kosztorys/types'
import type { ReportStatusT } from '@/lib/kosztorys/worker-report/report-status'
import type { MediaFileT } from '@/types/media'

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

export type ScanPageT = z.infer<typeof scanPageSchema>

export type CreateScannedReportInputT = z.input<typeof createScannedReportSchema>

export type ReportLineKindT = 'rozpiska' | 'extra'

export type ReportSourceT = 'link' | 'scan'

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
  // Extras only, filled after the send. Both undefined = not translated (yet); a `pl` language with
  // no Polish = the worker wrote Polish.
  polishDescription: string | undefined
  descriptionLanguage: string | undefined
  // Scans only: the AI was unsure of the ilość, or the number on the paper matched no pozycja.
  isUncertain: boolean
  scannedRef: string | undefined
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
  source: ReportSourceT
  // The kierownik who filed a scan; undefined on a report the worker sent himself.
  createdByName: string | undefined
  sentAt: string
  status: ReportStatusT
  decidedAt: string | undefined
  decidedBy: string | undefined
  target: ReportTargetT | undefined
  lineCount: number
  acceptedLineCount: number
}

export type WorkerReportT = WorkerReportSummaryT & { lines: ReportLineT[]; photos: MediaFileT[] }

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
