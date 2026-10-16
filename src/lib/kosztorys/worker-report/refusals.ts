import { pl } from '@/lib/i18n/dictionaries/pl'
import type { NoticeKeyT } from '@/lib/i18n/notice-failure'

export type ReportNoticeKeyT = NoticeKeyT

export const REPORT_REFUSALS = {
  unknownToken: pl.notices.unknownToken,
  closed: pl.notices.closed,
  template: pl.notices.template,
  inactiveWorker: pl.notices.inactiveWorker,
  foreignItem: pl.notices.foreignItem,
  stagesCompleted: pl.notices.stagesCompleted,
} as const satisfies Partial<Record<ReportNoticeKeyT, string>>

export type ReportRefusalKeyT = keyof typeof REPORT_REFUSALS

export const ACCEPT_REFUSALS = {
  lostRecordedStage:
    'Część zgłoszenia przyjęto do etapu, którego już nie ma albo w którym nie ma już tego pracownika. Odznacz te prace, zanim dodasz resztę do innego etapu.',
  unsettledPlane:
    'Rozliczenie etapów tego pracownika nie jest ustalone — wybierz jeden z jego etapów.',
} as const
