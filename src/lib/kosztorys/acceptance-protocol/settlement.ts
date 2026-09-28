import { sumDeposits } from '@/lib/kosztorys/deposit-planes'
import { effectiveMaterialsNetRate, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import {
  billedMaterials,
  computeAmountDue,
  type MaterialsT,
} from '@/lib/kosztorys/summary-economics'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { DepositTransactionRowT } from '@/types/transfers'
import type { ProtocolSettlementT } from '@/lib/kosztorys/acceptance-protocol/types'

type ArgsT = {
  laborCostsNet: number
  materials: MaterialsT
  settlementMode: SettlementModeT
  materialsNetRate: number | null
  vatRate: number
  depositTransactions: DepositTransactionRowT[]
  lossAmount: number
}

// The „Podsumowanie" netto column, composed from the same functions — a protocol that disagreed
// with the summary by a grosz would be the one the client signs.
export function protocolSettlement({
  laborCostsNet,
  materials,
  settlementMode,
  materialsNetRate,
  vatRate,
  depositTransactions,
  lossAmount,
}: ArgsT): ProtocolSettlementT {
  const netRate = effectiveMaterialsNetRate(settlementMode, materialsNetRate)
  const paid = sumDeposits(depositTransactions)
  const materialsNet = billedMaterials(materials, netRate)
  const remainingNet = computeAmountDue(
    laborCostsNet,
    paid,
    materials,
    vatRate,
    netRate,
    lossAmount,
  ).net
  return {
    laborCostsNet,
    materialsNet,
    totalNet: laborCostsNet + materialsNet,
    paidNet: paid.net,
    lossNet: lossAmount,
    remainingNet,
    isOverpaid: roundToCents(remainingNet) < 0,
  }
}
