export type MaterialShopPriceT = {
  shop: string
  qty: number
  orders: number
  avgNet: number
  minNet: number
  maxNet: number
  lastNet: number
  lastDate: string
}

export type MaterialPurchaseT = {
  shop: string
  date: string
  doc: string
  investmentId?: number
  qty: number
  net: number
  gross: number
  odd: boolean
}

export type MaterialT = {
  id: string
  type: string
  product: string
  pack: string
  kind: string
  qty: number
  orders: number
  investments: number
  avgNet: number
  minNet: number
  maxNet: number
  spread: number
  cheapestShop: string
  lastNet: number
  lastDate: string
  gross: number
  names: string[]
  shops: MaterialShopPriceT[]
  purchases: MaterialPurchaseT[]
}

export type MaterialRowT = Omit<MaterialT, 'names' | 'shops' | 'purchases'> & {
  shopNames: string[]
}

export type MaterialPricePointT = Pick<
  MaterialPurchaseT,
  'shop' | 'date' | 'doc' | 'qty' | 'net'
> & {
  time: number
}
