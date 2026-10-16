import { pl } from '@/lib/i18n/dictionaries/pl'
import type { MessageKeyT } from '@/lib/i18n/translations'
import type { DiscountTypeT, PriceSourceT, ReviewStatusT, ToolPlaneT } from '@/lib/kosztorys/types'

export const PLANE_LABEL_KEYS: Record<ToolPlaneT, MessageKeyT<'grid'>> = {
  w_tools: 'planeWithTools',
  own_tools: 'planeOwnTools',
}

export const PLANE_LABELS: Record<ToolPlaneT, string> = {
  w_tools: pl.grid[PLANE_LABEL_KEYS.w_tools],
  own_tools: pl.grid[PLANE_LABEL_KEYS.own_tools],
}

export const RATE_LABELS: Record<ToolPlaneT, string> = {
  w_tools: `Stawka ${PLANE_LABELS.w_tools.toLowerCase()}`,
  own_tools: `Stawka ${PLANE_LABELS.own_tools.toLowerCase()}`,
}

export const DISCOUNT_TYPE_LABELS: Record<DiscountTypeT, string> = { percent: '%', amount: 'zł' }

export const PRICE_SOURCE_LABELS: Record<PriceSourceT, string> = {
  auto: 'auto',
  coeff: 'własny mnożnik',
  amount: 'kwota stała',
}

export const SUBCONTRACTOR_FIGURE_LABELS = {
  due: 'Suma wykonanej pracy',
  bonus: 'Premia',
  payouts: 'Zaliczki (wypłaty)',
  remaining: 'Pozostało do wypłaty',
} as const

export const REVIEW_STATUS_LABELS: Record<ReviewStatusT, string> = {
  accepted: 'Zaakceptowana',
  rejected: 'Odrzucona',
  edited: 'Edytowana',
  added: 'Dodana',
}

export const REVIEW_STATUS_UNSET_LABEL = 'Do sprawdzenia'

export const RECHECK_LABEL = 'Do ponownego sprawdzenia'
