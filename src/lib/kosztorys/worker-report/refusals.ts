import { pl } from '@/lib/i18n/dictionaries/pl'
import type { NoticeKeyT } from '@/lib/i18n/notice-failure'

export type ReportNoticeKeyT = NoticeKeyT

// Shared by the report page (a notice instead of the form) and `tokenAction` (a refused send from a
// page opened before the state changed), so the worker reads the same sentence either way. Worded by
// the Polish dictionary, so the key the report page translates can never drift from the text.
export const REPORT_REFUSALS = {
  unknownToken: pl.notices.unknownToken,
  // The gate's own sentences tell a kierownik to reopen the investment — a control the worker has not got.
  closed: pl.notices.closed,
  template: pl.notices.template,
  inactiveWorker: pl.notices.inactiveWorker,
  foreignItem: pl.notices.foreignItem,
} as const satisfies Partial<Record<ReportNoticeKeyT, string>>

export type ReportRefusalKeyT = keyof typeof REPORT_REFUSALS

// The review dialog blocks „Przyjmij" with the sentence the server would refuse it with.
export const ACCEPT_REFUSALS = {
  lostRecordedStage:
    'Część zgłoszenia przyjęto do etapu, którego już nie ma albo w którym nie ma już tego pracownika. Odznacz te prace, zanim dodasz resztę do innego etapu.',
  unsettledPlane:
    'Rozliczenie etapów tego pracownika nie jest ustalone — wybierz jeden z jego etapów.',
} as const
