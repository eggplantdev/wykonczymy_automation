import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import type { WorkerReportFormDataT } from '@/lib/kosztorys/worker-report/types'

const COMMON_UNIT_COUNT = 6

export function toWorkerReportFormData(
  data: Extract<WorkerKosztorysT, { kind: 'ready' }>,
): WorkerReportFormDataT {
  const { tree } = data
  const sections = tree.sections
    .map((section) => ({
      id: section.id,
      name: section.name,
      color: section.color,
      items: section.items
        .filter((item) => item.description)
        .map((item) => ({
          id: item.id,
          description: item.description ?? '',
          unit: item.unit ?? '',
        })),
    }))
    .filter((section) => section.items.length > 0)

  const unitCounts = new Map<string, number>()
  for (const section of sections) {
    for (const item of section.items) {
      if (item.unit) unitCounts.set(item.unit, (unitCounts.get(item.unit) ?? 0) + 1)
    }
  }

  return {
    investmentId: data.investmentId,
    investmentName: data.investmentName,
    workerId: data.worker.workerId,
    workerName: data.worker.name,
    sections,
    commonUnits: [...unitCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, COMMON_UNIT_COUNT)
      .map(([unit]) => unit),
  }
}
