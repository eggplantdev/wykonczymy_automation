import { stageLabel } from '@/lib/kosztorys/stage-label'
import type { SubcontractorDueByPlaneT } from '@/lib/kosztorys/subcontractor-due'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { roundToCents } from '@/lib/utils/round-to-cents'

export type StageBreakdownWorkerT = { workerId: number | null; name: string }

export type StageBreakdownRowT = {
  stageId: number
  label: string
  wholeNet: number
  // One cell per `workers` column; null where that person takes nothing of this etap.
  shares: (number | null)[]
}

export type StageBreakdownT = {
  workers: StageBreakdownWorkerT[]
  rows: StageBreakdownRowT[]
  totals: { wholeNet: number; shares: number[] }
}

/**
 * „Podsumowanie pracowników" one level finer, read off `byStageWorker` — the map `byWorker` sums — so
 * a worker's column total is his „Suma wykonanej pracy" by construction, the unassigned remainder
 * in the `null` column. An etap with nothing executed, or with no rozliczenie, shows nothing to
 * divide and is left out; so is a worker who takes nothing from the etapy that remain.
 */
export function subcontractorStageBreakdown(
  due: SubcontractorDueByPlaneT,
  stages: KosztorysStageT[],
  workers: StageBreakdownWorkerT[],
): StageBreakdownT {
  const priced = stages.flatMap((stage) => {
    const wholeNet = due.byStage.get(stage.id) ?? 0
    return roundToCents(wholeNet) === 0 ? [] : [{ stage, wholeNet }]
  })
  const columns = workers
    .map((worker) => ({
      worker,
      cells: priced.map(({ stage }) => {
        const share = due.byStageWorker.get(stage.id)?.get(worker.workerId)
        return share === undefined || roundToCents(share) === 0 ? null : share
      }),
    }))
    .filter(({ cells }) => cells.some((cell) => cell !== null))

  const rows = priced.map(({ stage, wholeNet }, index) => ({
    stageId: stage.id,
    label: stageLabel(stage),
    wholeNet,
    shares: columns.map(({ cells }) => cells[index]),
  }))
  return {
    workers: columns.map(({ worker }) => worker),
    rows,
    totals: {
      wholeNet: rows.reduce((sum, row) => sum + row.wholeNet, 0),
      shares: columns.map(({ cells }) => cells.reduce<number>((sum, cell) => sum + (cell ?? 0), 0)),
    },
  }
}
