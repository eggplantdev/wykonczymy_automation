import { rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import type { InvestmentRefT } from '@/types/reference-data'
import type {
  AcceptanceKindT,
  AcceptanceProtocolFormT,
} from '@/lib/kosztorys/acceptance-protocol/types'

type ArgsT = {
  investment: InvestmentRefT
  rows: KosztorysV2RowT[]
  stages: KosztorysStageT[]
  today: string
}

export function protocolFormDefaults({
  investment,
  rows,
  stages,
  today,
}: ArgsT): AcceptanceProtocolFormT {
  return {
    kind: defaultKind(rows, stages),
    place: '',
    issueDate: today,
    acceptanceDate: today,
    readinessDate: '',
    clientName: prefilledClientName(investment),
    siteAddress: investment.address,
    paymentDueDate: '',
  }
}

// The osoba kontaktowa is filled on a handful of investments; the name usually carries the client,
// so it is the better guess than a blank.
export function prefilledClientName(investment: InvestmentRefT): string {
  return investment.contactPerson.trim() || investment.name
}

// A guess the owner can overrule: „końcowy" only once every offered pozycja is fully executed.
function defaultKind(rows: KosztorysV2RowT[], stages: KosztorysStageT[]): AcceptanceKindT {
  const offered = rows.filter((row) => row.plannedQty > 0)
  if (offered.length === 0) return 'partial'
  const isComplete = offered.every(
    (row) => rowTotalQtyDone(row, stages, 'client') >= row.plannedQty,
  )
  return isComplete ? 'final' : 'partial'
}
