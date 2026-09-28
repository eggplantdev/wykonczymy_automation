'use server'

import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import { getWorkerKosztorysPreview } from '@/lib/queries/worker-kosztorys'

// The PDF prints the worker's projection, not the editor's rows: the editor holds every etap and the
// client price, and the paper must be the link's twin. The session gate is inside the wrapped read.
export async function getWorkerKosztorysPrintData(
  investmentId: number,
  workerId: number,
): Promise<WorkerKosztorysT | null> {
  return getWorkerKosztorysPreview(investmentId, workerId)
}
