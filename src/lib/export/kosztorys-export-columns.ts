import { v2ToggleableColumns } from '@/lib/tables/kosztorys-v2-columns'
import {
  rowNetForView,
  rowRemainingForView,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { rowDoneNetForView } from '@/lib/kosztorys/v2-rows'
import { formatPLN } from '@/lib/format-currency'
import type { KosztorysStageT, KosztorysV2RowT, ViewPricingT } from '@/types/kosztorys'

export type KosztorysExportColumnT = {
  id: string
  label: string
  getValue: (row: KosztorysV2RowT, view: PriceViewT) => string
}

const DISCOUNT_LABEL: Record<string, string> = { percent: '%', amount: 'zł' }

function grossForView(r: KosztorysV2RowT, view: PriceViewT): number {
  return rowNetForView(r as unknown as ViewPricingT, view) * (1 + r.vatRate)
}

// getValue per id. Etapy (stage_<id>) i nieznane id → odczyt liczbowy z wiersza.
// `stages` potrzebne tylko kolumnie „Pozostało" (suma wykonanych etapów).
function getValueForId(id: string, stages: KosztorysStageT[]): KosztorysExportColumnT['getValue'] {
  switch (id) {
    case 'sectionName':
      return (r) => r.sectionName
    case 'description':
      return (r) => r.description ?? ''
    case 'unit':
      return (r) => r.unit ?? ''
    case 'plannedQty':
      return (r) => String(r.plannedQty)
    case 'measuredQty':
      return (r) => String(r.measuredQty)
    case 'price':
      return (r, view) => formatPLN(viewPrice(r as unknown as ViewPricingT, view))
    case 'discountType':
      return (r) => (r.discountType ? DISCOUNT_LABEL[r.discountType] : '')
    case 'discountValue':
      return (r) => String(r.discountValue)
    case 'net':
      return (r, view) => formatPLN(rowNetForView(r as unknown as ViewPricingT, view))
    case 'gross':
      return (r, view) => formatPLN(grossForView(r, view))
    case 'remaining':
      return (r, view) =>
        formatPLN(
          rowRemainingForView(
            r as unknown as ViewPricingT,
            rowDoneNetForView(r, stages, view),
            view,
          ),
        )
    default:
      // stage_<id>: ilość wykonana w etapie (klucz spłaszczony na wierszu v2).
      return (r) => {
        const v = r[id as `stage_${number}`]
        return v == null ? '' : String(v)
      }
  }
}

/**
 * Kolumny eksportu = kolumny przełącznika widoczności (ten sam id/label/kolejność),
 * każda z getValue. Snapshot WYSIWYG: konsument odfiltrowuje ukryte po id.
 */
export function buildKosztorysExportColumns(stages: KosztorysStageT[]): KosztorysExportColumnT[] {
  return v2ToggleableColumns(stages).map(({ id, label }) => ({
    id,
    label,
    getValue: getValueForId(id, stages),
  }))
}
