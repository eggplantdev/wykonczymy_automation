import type { WorkerScopeBlockReasonT } from '@/lib/kosztorys/worker-view/scope'

export const WORKER_SCOPE_BLOCK_MESSAGES: Record<WorkerScopeBlockReasonT, string> = {
  'no-stages': 'Brak przypisanych etapów',
  'unconfirmed-plane': 'Ustaw rozliczenie etapu',
  'mixed-planes': 'Etapy pracownika mają różne rozliczenia',
}
