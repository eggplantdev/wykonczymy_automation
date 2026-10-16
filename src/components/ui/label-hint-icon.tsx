import { TriangleAlert } from 'lucide-react'
import { HintTooltip } from '@/components/ui/tooltip'

const VARIANT = {
  mismatch: {
    Icon: TriangleAlert,
    className: 'text-destructive',
    ariaLabel: 'Niezgodność z transakcjami',
  },
  planeUnconfirmed: {
    Icon: TriangleAlert,
    className: 'text-destructive',
    ariaLabel: 'Rozliczenie etapu niepotwierdzone',
  },
  strandedDeposits: {
    Icon: TriangleAlert,
    className: 'text-destructive',
    ariaLabel: 'Wpłaty poza trybem rozliczenia',
  },
  splitScaled: {
    Icon: TriangleAlert,
    className: 'text-destructive',
    ariaLabel: 'Podział etapu do poprawienia',
    content:
      'Wykonana praca spadła poniżej wpisanych kwot, więc zostały proporcjonalnie zmniejszone, a główny dostaje 0 zł. Popraw podział w „Pracownicy etapu…".',
  },
  noStages: {
    Icon: TriangleAlert,
    className: 'text-destructive',
    ariaLabel: 'Pracownik bez przypisanych etapów',
    content:
      'Ta osoba nie ma przypisanego żadnego etapu na tej inwestycji, więc jej „należne” to 0 — wypłata pokaże się jako nadpłata, dopóki etapy nie zostaną przypisane.',
  },
} as const

export type LabelHintT =
  | { variant: 'mismatch'; content: string }
  | { variant: 'planeUnconfirmed'; content: string }
  | { variant: 'strandedDeposits'; content: string }
  | { variant: 'noStages' }
  | { variant: 'splitScaled' }

const SIZE = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' } as const

type LabelHintIconPropsT = LabelHintT & { size?: keyof typeof SIZE }

export function LabelHintIcon({ size = 'sm', ...hint }: LabelHintIconPropsT) {
  const spec = VARIANT[hint.variant]
  const content = 'content' in hint ? hint.content : VARIANT[hint.variant].content
  const { Icon } = spec

  return (
    <HintTooltip content={content} className={spec.className}>
      <Icon className={SIZE[size]} aria-label={spec.ariaLabel} />
    </HintTooltip>
  )
}
