import 'server-only'
import snapshot from './price-list.json'
import type { MaterialRowT, MaterialT } from './types'

export const PRICE_LIST_DATE: string = snapshot.generatedAt
export const MATERIALS: MaterialT[] = snapshot.materials

export const findMaterial = (id: string) => MATERIALS.find((material) => material.id === id)

export const toMaterialRow = ({
  names: _names,
  shops,
  purchases: _purchases,
  ...row
}: MaterialT): MaterialRowT => ({ ...row, shopNames: shops.map((shop) => shop.shop) })
