import { toMoney } from '@/lib/utils/parse-decimal-input'

export type RowValueT = { ticked: boolean; amount: string }

export const amountOf = (value: RowValueT) => toMoney(value.amount)
export const isValidAmount = (value: RowValueT) => amountOf(value) > 0
