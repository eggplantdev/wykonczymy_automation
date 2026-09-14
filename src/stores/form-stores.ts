import { createFormStore } from '@/stores/create-form-store'
import type { InvestmentFormValuesT } from '@/components/forms/investment-form/investment-schema'
import type { WorkerFormValuesT } from '@/components/forms/worker-form/worker-schema'
import type { CashRegisterFormValuesT } from '@/components/forms/cash-register-form/cash-register-schema'
import type { BulkExpenseFormValuesT } from '@/components/forms/expense-form/bulk-expense-form'
import type { VehicleFormValuesT } from '@/components/forms/vehicle-form/vehicle-schema'
import type { InspectionFormValuesT } from '@/components/forms/inspection-form/inspection-schema'
import type { RecipientListFormValuesT } from '@/components/forms/recipient-list-form/recipient-list-schema'
import type { WorkCatalogueItemFormValuesT } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import type {
  AddEquipmentFormValuesT,
  EquipmentFormValuesT,
} from '@/components/forms/equipment-form/equipment-schema'
import type { EquipmentTransferFormValuesT } from '@/components/forms/equipment-transfer-form/equipment-transfer-schema'

type DepositFormValuesT = {
  description: string
  amount: string
  amountGross: string
  date: string
  type: string
  paymentMethod: string
  vatPlane?: string
  sourceRegister: string
  investment?: string
}

type InternalTransferFormValuesT = {
  description: string
  amount: string
  date: string
  sourceRegister: string
  targetRegister: string
}

export const useDepositFormStore = createFormStore<DepositFormValuesT>('deposit-form')
export const useExpenseFormStore = createFormStore<BulkExpenseFormValuesT>('expense-form')
export const useInternalTransferFormStore =
  createFormStore<InternalTransferFormValuesT>('internal-transfer-form')
export const useInvestmentFormStore = createFormStore<InvestmentFormValuesT>('investment-form')
export const useWorkerFormStore = createFormStore<WorkerFormValuesT>('worker-form')
export const useCashRegisterFormStore =
  createFormStore<CashRegisterFormValuesT>('cash-register-form')
export const useVehicleFormStore = createFormStore<VehicleFormValuesT>('vehicle-form')
export const useWorkCatalogueItemFormStore = createFormStore<WorkCatalogueItemFormValuesT>(
  'work-catalogue-item-form',
)
export const useInspectionFormStore = createFormStore<InspectionFormValuesT>('inspection-form')
export const useRecipientListFormStore =
  createFormStore<RecipientListFormValuesT>('recipient-list-form')
export const useEquipmentFormStore = createFormStore<EquipmentFormValuesT>('equipment-form')
export const useAddEquipmentFormStore =
  createFormStore<AddEquipmentFormValuesT>('add-equipment-form')
export const useEquipmentTransferFormStore =
  createFormStore<EquipmentTransferFormValuesT>('equipment-transfer-form')
