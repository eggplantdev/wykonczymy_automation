import type { z } from 'zod'
import type { StageProgressCellT } from '@/lib/db/stage-progress'
import type { LanguageT } from '@/lib/i18n/languages'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type {
  acceptSchema,
  createScannedReportSchema,
  scanPageSchema,
  sendLineSchema,
} from '@/lib/kosztorys/worker-report/schemas'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
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

export type ReportLineT = {
  id: number
  kind: ReportLineKindT
  itemId: number | undefined
  description: string
  unit: string
  sectionName: string | undefined
  reportedQty: number
  acceptedQty: number | undefined
  isRejected: boolean
  createdItemId: number | undefined
  catalogueItemId: number | undefined
  // Both undefined = not translated (yet); a `pl` language with no Polish = the worker wrote Polish.
  polishDescription: string | undefined
  descriptionLanguage: string | undefined
  isUncertain: boolean
  scannedRef: string | undefined
}

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
  workerLanguage: LanguageT | undefined
  source: ReportSourceT
  createdByName: string | undefined
  sentAt: string
  status: ReportStatusT
  decidedAt: string | undefined
  decidedBy: string | undefined
  target: ReportTargetT | undefined
  lineCount: number
  acceptedLineCount: number
  rejectedLineCount: number
}

export type WorkerReportT = WorkerReportSummaryT & { lines: ReportLineT[]; photos: MediaFileT[] }

export type AcceptReportInputT = z.input<typeof acceptSchema>

export type AcceptTargetT = AcceptReportInputT['target']

export type AcceptReportResultT = {
  stage: KosztorysStageT | undefined
  cells: StageProgressCellT[]
  revision: string | undefined
}

export type ReportLineOutcomeT =
  | { kind: 'accepted'; qty: number }
  | { kind: 'pending' }
  | { kind: 'rejected' }

export type ReportPreviewLineT = {
  id: number
  kind: ReportLineKindT
  ref: number | undefined
  scannedRef: string | undefined
  sectionName: string
  sectionColor: SectionColorKeyT | null
  description: string
  workerDescription: string | undefined
  workerDescriptionLanguage: string | undefined
  unit: string
  reportedQty: number
  outcome: ReportLineOutcomeT
}

export type ReportPreviewT = {
  id: number
  investmentId: number
  investmentName: string
  workerName: string
  status: ReportStatusT
  source: ReportSourceT
  createdByName: string | undefined
  sentAt: string
  decidedAt: string | undefined
  decidedByName: string | undefined
  lineCount: number
  acceptedLineCount: number
  rejectedLineCount: number
  photos: MediaFileT[]
  lines: ReportPreviewLineT[]
}
