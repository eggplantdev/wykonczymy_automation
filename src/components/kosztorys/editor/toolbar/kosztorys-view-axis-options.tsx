import { Activity, Coins, Hammer, Receipt, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { PLANE_LABELS, RATE_LABELS, TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { PairAxisConfigT } from '@/lib/kosztorys/axis-checkboxes'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { LayerT } from '@/lib/kosztorys/layer'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'

const ICON_CLASS = 'size-4'

// Three views over one dataset: they only change the active price and its derived values. The two
// subcontractor views share their glyphs with the etap header via planeIcon (can't drift).
export const VIEWS: { value: PriceViewT; label: string; icon: ReactNode }[] = [
  { value: 'client', label: 'Inwestor', icon: <User className={ICON_CLASS} /> },
  ...TOOL_PLANES.map((plane) => ({
    value: plane,
    label: PLANE_LABELS[plane],
    icon: planeIcon(plane, ICON_CLASS),
  })),
]

export const VIEW_LEGEND = [
  'Widoki cen:',
  '👤 Inwestor — cena dla inwestora.',
  `🔧 ${RATE_LABELS.w_tools}.`,
  `🚫 ${RATE_LABELS.own_tools}.`,
].join('\n')

export const MONEY_AXES: {
  value: MoneyAxisT
  label: string
  icon: ReactNode
}[] = [
  { value: 'net', label: 'Netto', icon: <Coins className={ICON_CLASS} /> },
  { value: 'gross', label: 'Brutto', icon: <Receipt className={ICON_CLASS} /> },
]

export const MONEY_PAIR_CONFIG: PairAxisConfigT<MoneyAxisT> = {
  a: 'net',
  b: 'gross',
  both: 'both',
  none: 'none',
}

// The Kolumny toggle is the strictest gate: an unchecked column is ANDed out in buildV2Columns
// before any axis predicate runs, so it stays hidden regardless of the Kwoty/Warstwy options.
export const KOLUMNY_HINT =
  'Jeśli odznaczysz którąś kolumnę, nie będzie widoczna niezależnie od wybranych opcji powyżej.'

export const LAYERS: {
  value: LayerT
  label: string
  icon: ReactNode
}[] = [
  { value: 'work', label: 'Praca', icon: <Hammer className={ICON_CLASS} /> },
  { value: 'progress', label: 'Postęp', icon: <Activity className={ICON_CLASS} /> },
]

export const LAYER_PAIR_CONFIG: PairAxisConfigT<LayerT> = {
  a: 'work',
  b: 'progress',
  both: 'both',
  none: 'none',
}
