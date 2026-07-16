import { Banknote, Coins, Columns2, Percent, Receipt, Slash, User, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PriceViewT } from '@/lib/kosztorys/calc'
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
        <Slash className="absolute inset-0 size-4" />
        <Slash className="absolute inset-0 size-4 -scale-x-100" />
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
  hint: string
  icon: ReactNode
}[] = [
  {
    value: 'net',
    label: 'Netto',
    hint: 'chowa kolumny brutto',
    icon: <Coins className={ICON_CLASS} />,
  },
  {
    value: 'gross',
    label: 'Brutto',
    hint: 'netto + VAT; chowa kolumny netto',
    icon: <Receipt className={ICON_CLASS} />,
  },
  {
    value: 'both',
    label: 'Bez filtra',
    hint: 'pokazuje netto i brutto obok siebie',
    icon: <Columns2 className={ICON_CLASS} />,
  },
]

export const AXIS_LEGEND = [
  'Kwoty w tabeli:',
  ...MONEY_AXES.map((axis) => `${axis.label} — ${axis.hint}.`),
].join('\n')

export const PROGRESS_DISPLAYS: {
  value: ProgressDisplayT
  label: string
  hint: string
  icon: ReactNode
}[] = [
  {
    value: 'values',
    label: 'Kwoty',
    hint: 'etapy pokazują kwoty',
    icon: <Banknote className={ICON_CLASS} />,
  },
  {
    value: 'percent',
    label: '% wykonania',
    hint: 'etapy pokazują procent zamiast kwot',
    icon: <Percent className={ICON_CLASS} />,
  },
]

export const PROGRESS_DISPLAY_LEGEND = [
  'Etapy w tabeli:',
  ...PROGRESS_DISPLAYS.map((display) => `${display.label} — ${display.hint}.`),
  '',
  'W trybie procentowym każdy etap ma jedną kolumnę zamiast pary netto/brutto — procent jest ten sam po obu stronach.',
  'Kolumna „% wykonania" (całej pozycji) jest dostępna w obu trybach.',
].join('\n')
