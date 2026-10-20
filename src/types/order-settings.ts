export type SupplierT = { id: string; name: string; phone: string }

export type OrderSettingsT = {
  suppliers: SupplierT[]
  bigBagPrice: number
  containerPrice: number
  defaultBigBagSupplierId: string | undefined
  defaultContainerSupplierId: string | undefined
}
