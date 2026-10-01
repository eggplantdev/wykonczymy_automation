import { pl } from '@/lib/i18n/dictionaries/pl'
import type { MessageKeyT } from '@/lib/i18n/translations'
import type { WorkerScopeBlockReasonT } from '@/lib/kosztorys/worker-view/scope'

export const WORKER_SCOPE_BLOCK_NOTICE_KEYS: Record<WorkerScopeBlockReasonT, MessageKeyT<'notices'>> =
  {
    'no-stages': 'noStages',
    'unconfirmed-plane': 'unconfirmedPlane',
    'mixed-planes': 'mixedPlanes',
  }

export const WORKER_SCOPE_BLOCK_MESSAGES: Record<WorkerScopeBlockReasonT, string> = {
  'no-stages': pl.notices[WORKER_SCOPE_BLOCK_NOTICE_KEYS['no-stages']],
  'unconfirmed-plane': pl.notices[WORKER_SCOPE_BLOCK_NOTICE_KEYS['unconfirmed-plane']],
  'mixed-planes': pl.notices[WORKER_SCOPE_BLOCK_NOTICE_KEYS['mixed-planes']],
}
