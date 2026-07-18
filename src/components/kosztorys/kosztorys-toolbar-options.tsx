import {
  Activity,
  Banknote,
  Coins,
  Hammer,
  Percent,
  Receipt,
  Slash,
  User,
  Wrench,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { PairAxisConfigT } from '@/lib/kosztorys/axis-checkboxes'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { LayerT } from '@/lib/kosztorys/layer'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { ProgressDisplayT } from '@/lib/kosztorys/progress-display'

const ICON_CLASS = 'size-4'

// Three views over one dataset: they only change the active price and its derived values.
export const VIEWS: { value: PriceViewT; label: string; icon: ReactNode }[] = [
  { value: 'client', label: 'Klient', icon: <User className={ICON_CLASS} /> },
  { value: 'w_tools', label: 'Z narzędziami', icon: <Wrench className={ICON_CLASS} /> },
  {
    value: 'own_tools',
    label: 'Bez narzędzi',
    // No native crossed-wrench glyph — overlay two mirrored Slashes into an X to read as "tools off".
    icon: (
      <span className="relative inline-flex">
        <Wrench className={ICON_CLASS} />
        <Slash className="absolute inset-0" />
        <Slash className="absolute inset-0 -scale-x-100" />
      </span>
    ),
  },
]

export const VIEW_LEGEND = [
  'Widoki cen:',
  '👤 Klient — cena dla klienta.',
  '🔧 Stawka wykonawcy z narzędziami.',
  '🚫 Stawka wykonawcy bez narzędzi.',
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
// before any axis predicate runs, so it stays hidden regardless of the Kwoty/Warstwy/Etapy options.
export const KOLUMNY_HINT =
  'Jeśli odznaczysz którąś kolumnę, nie będzie widoczna niezależnie od wybranych opcji powyżej.'

// Governs the stage-value block (kwoty + % columns), unlike the other axes.
export const PROGRESS_DISPLAYS: {
  value: ProgressDisplayT
  label: string
  icon: ReactNode
}[] = [
  { value: 'values', label: 'PLN', icon: <Banknote className={ICON_CLASS} /> },
  { value: 'percent', label: 'Procent', icon: <Percent className={ICON_CLASS} /> },
]

export const PROGRESS_PAIR_CONFIG: PairAxisConfigT<ProgressDisplayT> = {
  a: 'values',
  b: 'percent',
  both: 'both',
  none: 'none',
}

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
