export type RowValueT = { ticked: boolean; amount: string }

export const amountOf = (value: RowValueT) => Number(value.amount.replace(',', '.'))
export const isValidAmount = (value: RowValueT) => amountOf(value) > 0
