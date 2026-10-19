export type SupplierT = { id: string; name: string; phone: string }

export type OrderSettingsT = {
  suppliers: SupplierT[]
  bigBagPrice: number
  containerPrice: number
  defaultSupplierId: string | undefined
}
