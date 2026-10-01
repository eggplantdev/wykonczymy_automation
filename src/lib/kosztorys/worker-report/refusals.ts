import { pl } from '@/lib/i18n/dictionaries/pl'
import type { MessageKeyT } from '@/lib/i18n/translations'
import type { WorkerScopeBlockReasonT } from '@/lib/kosztorys/worker-view/scope'

export type ReportNoticeKeyT = MessageKeyT<'notices'>

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

export const WORKER_SCOPE_BLOCK_NOTICE_KEYS: Record<WorkerScopeBlockReasonT, ReportNoticeKeyT> = {
  'no-stages': 'noStages',
  'unconfirmed-plane': 'unconfirmedPlane',
  'mixed-planes': 'mixedPlanes',
}

export const reportRefusal = (key: ReportNoticeKeyT) => ({
  success: false as const,
  error: pl.notices[key],
  messageKey: key,
})

// A Zod refusal carries only its sentence. The report schemas word theirs from the Polish dictionary,
// so the sentence finds its key back.
export const reportNoticeKeyOf = (text: string): ReportNoticeKeyT | undefined =>
  (Object.keys(pl.notices) as ReportNoticeKeyT[]).find((key) => pl.notices[key] === text)

// The review dialog blocks „Przyjmij" with the sentence the server would refuse it with.
export const ACCEPT_REFUSALS = {
  lostRecordedStage:
    'Część zgłoszenia przyjęto do etapu, którego już nie ma albo w którym nie ma już tego pracownika. Odznacz te prace, zanim dodasz resztę do innego etapu.',
  unsettledPlane:
    'Rozliczenie etapów tego pracownika nie jest ustalone — wybierz jeden z jego etapów.',
} as const
