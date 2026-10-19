const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/

export const isOrderPrice = (text: string) => PRICE_PATTERN.test(text) && Number(text) > 0
