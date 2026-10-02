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
 * „Podsumowanie pracowników" one level finer: each etap's value and who takes how much of it. Read
 * off the same `subcontractorDueByPlane` pass, so a worker's column total is his „Suma wykonanej
 * pracy" by construction. The unassigned remainder of an etap goes to the `null` column, as it does
 * in `byWorker`. An etap with nothing executed, or with no rozliczenie, shows nothing to divide and
 * is left out; so is a worker who takes nothing from the etapy that remain.
 */
export function subcontractorStageBreakdown(
  due: SubcontractorDueByPlaneT,
  stages: KosztorysStageT[],
  workers: StageBreakdownWorkerT[],
): StageBreakdownT {
  const priced = stages.filter((stage) => roundToCents(due.byStage.get(stage.id) ?? 0) !== 0)
  const cellsOf = (stage: KosztorysStageT) => {
    const wholeNet = due.byStage.get(stage.id) ?? 0
    const shares = due.byStageWorker.get(stage.id)
    const unattributed = stage.split
      ? wholeNet - [...(shares?.values() ?? [])].reduce((sum, share) => sum + share, 0)
      : wholeNet
    return workers.map(({ workerId }) => {
      if (workerId === null) return roundToCents(unattributed) === 0 ? null : unattributed
      return shares?.get(workerId) ?? null
    })
  }
  const allCells = priced.map(cellsOf)
  const kept = workers
    .map((_, column) => column)
    .filter((column) => allCells.some((cells) => cells[column] !== null))

  const rows = priced.map((stage, index) => ({
    stageId: stage.id,
    label: stageLabel(stage),
    wholeNet: due.byStage.get(stage.id) ?? 0,
    shares: kept.map((column) => allCells[index][column]),
  }))
  return {
    workers: kept.map((column) => workers[column]),
    rows,
    totals: {
      wholeNet: rows.reduce((sum, row) => sum + row.wholeNet, 0),
      shares: kept.map((_, column) =>
        rows.reduce((sum, row) => sum + (row.shares[column] ?? 0), 0),
      ),
    },
  }
}
