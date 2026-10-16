import { Activity, Coins, Hammer, Receipt, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { PLANE_LABELS, RATE_LABELS } from '@/lib/kosztorys/labels'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { PairAxisConfigT } from '@/lib/kosztorys/axis-checkboxes'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { CrewAxisT } from '@/lib/kosztorys/crew-axis'
import type { LayerT } from '@/lib/kosztorys/layer'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'

const ICON_CLASS = 'size-4'

const PLANE_OPTIONS = TOOL_PLANES.map((plane) => ({
  value: plane,
  label: PLANE_LABELS[plane],
  icon: planeIcon(plane, ICON_CLASS),
}))

export const VIEWS: { value: PriceViewT; label: string; icon: ReactNode }[] = [
  { value: 'client', label: 'Inwestor', icon: <User className={ICON_CLASS} /> },
  ...PLANE_OPTIONS,
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

// The rate columns of one crew as a single tick — three columns per plane, and the plane-bound rows in
// „Filtry" with them.
export const CREWS: {
  value: CrewAxisT
  label: string
  icon: ReactNode
}[] = PLANE_OPTIONS

export const CREW_PAIR_CONFIG: PairAxisConfigT<CrewAxisT> = {
  a: 'w_tools',
  b: 'own_tools',
  both: 'both',
  none: 'none',
}
