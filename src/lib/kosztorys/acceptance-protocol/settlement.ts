import { sumDeposits } from '@/lib/kosztorys/deposit-planes'
import { effectiveMaterialsNetRate, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import {
  billedMaterials,
  computeAmountDue,
  type MaterialsT,
} from '@/lib/kosztorys/summary-economics'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { DepositTransactionRowT } from '@/types/transfers'
import type {
  ProtocolSettlementT,
  SettlementLineT,
} from '@/lib/kosztorys/acceptance-protocol/types'

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

// The „Podsumowanie" steps in its own order and signs: wpłaty and strata are deductions, so they
// read negative on the way down to what is left. One list for the dialog and the paper.
export function protocolSettlementLines(settlement: ProtocolSettlementT): SettlementLineT[] {
  const lines: SettlementLineT[] = [
    { label: 'Robocizna', amount: settlement.laborCostsNet },
    { label: 'Materiały', amount: settlement.materialsNet },
    { label: 'Suma', amount: settlement.totalNet, emphasis: 'subtotal' },
    { label: 'Wpłaty', amount: -settlement.paidNet },
  ]
  if (settlement.lossNet !== 0) lines.push({ label: 'Strata', amount: -settlement.lossNet })
  lines.push({
    label: settlement.isOverpaid ? 'Nadpłata' : 'Pozostało do zapłaty',
    amount: settlement.remainingNet,
    emphasis: 'total',
  })
  return lines
}
