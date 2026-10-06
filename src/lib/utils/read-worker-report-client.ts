import { postFormData } from '@/lib/utils/post-form-data'
import { MAX_SCAN_BYTES } from '@/lib/utils/scan-receipt-client'
import type { ScanPageT } from '@/lib/kosztorys/worker-report/types'

export async function readWorkerReportClient(
  file: File,
  investmentId: number,
  workerId: number,
): Promise<ScanPageT> {
  if (file.size > MAX_SCAN_BYTES) throw new Error('Zdjęcie jest za duże do odczytu')

  const formData = new FormData()
  formData.set('file', file)
  formData.set('investmentId', String(investmentId))
  formData.set('workerId', String(workerId))

  const body = await postFormData<{ data: ScanPageT }>(
    '/api/read-worker-report',
    formData,
    'Błąd odczytu kartki',
  )
  return body.data
}
