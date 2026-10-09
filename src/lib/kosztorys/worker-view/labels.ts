import { pl } from '@/lib/i18n/dictionaries/pl'
import type { MessageKeyT } from '@/lib/i18n/translations'
import type {
  ReportScopeRefusalT,
  WorkerScopeBlockReasonT,
} from '@/lib/kosztorys/worker-view/scope'

export const WORKER_SCOPE_BLOCK_NOTICE_KEYS: Record<
  WorkerScopeBlockReasonT,
  MessageKeyT<'notices'>
> = {
  'no-stages': 'noStages',
  'unconfirmed-plane': 'unconfirmedPlane',
  'mixed-planes': 'mixedPlanes',
}

export const WORKER_SCOPE_BLOCK_MESSAGES: Record<WorkerScopeBlockReasonT, string> = {
  'no-stages': pl.notices[WORKER_SCOPE_BLOCK_NOTICE_KEYS['no-stages']],
  'unconfirmed-plane': pl.notices[WORKER_SCOPE_BLOCK_NOTICE_KEYS['unconfirmed-plane']],
  'mixed-planes': pl.notices[WORKER_SCOPE_BLOCK_NOTICE_KEYS['mixed-planes']],
}

export const REPORT_SCOPE_REFUSAL_NOTICE_KEYS: Record<
  ReportScopeRefusalT,
  MessageKeyT<'notices'>
> = {
  ...WORKER_SCOPE_BLOCK_NOTICE_KEYS,
  'stages-completed': 'stagesCompleted',
}

// The management twin of the worker's `stagesCompleted` notice — it names the worker, not „you".
export const WORKER_STAGES_COMPLETED_MESSAGE =
  'Wszystkie etapy pracownika na tej inwestycji są zakończone — nie przyjmie już zgłoszeń prac.'

export const REPORT_SCOPE_REFUSAL_MESSAGES: Record<ReportScopeRefusalT, string> = {
  ...WORKER_SCOPE_BLOCK_MESSAGES,
  'stages-completed': WORKER_STAGES_COMPLETED_MESSAGE,
}
