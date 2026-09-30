import { TriangleAlert } from 'lucide-react'
import { HintTooltip } from '@/components/ui/tooltip'

// Variants are named by MEANING, not by look: three of these render the identical red TriangleAlert
// and differ only in the sentence they speak. That sentence is the load-bearing part — each
// `aria-label` is what a screen reader reads and what the E2E asserts on, so they must not be
// interchangeable. Pinning them here is what stops a surface reusing a neighbour's alarm and
// silently claiming the wrong thing. A variant whose copy never varies owns its `content` too.
//
// For a plain „więcej informacji" icon on a label, use `InfoTooltip` — this is for the fixed set of
// domain alarms that must read identically everywhere they appear.
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
      'Wykonana praca spadła poniżej wpisanych kwot, więc zostały proporcjonalnie zmniejszone, a osoba biorąca resztę dostaje 0 zł. Popraw podział w „Pracownicy etapu…".',
  },
  noStages: {
    Icon: TriangleAlert,
    className: 'text-destructive',
    ariaLabel: 'Pracownik bez przypisanych etapów',
    content:
      'Ta osoba nie ma przypisanego żadnego etapu na tej inwestycji, więc jej „należne” to 0 — wypłata pokaże się jako nadpłata, dopóki etapy nie zostaną przypisane.',
  },
} as const

// A variant that owns its copy takes no `content`; one explaining a per-row figure requires it.
export type LabelHintT =
  | { variant: 'mismatch'; content: string }
  | { variant: 'planeUnconfirmed'; content: string }
  | { variant: 'strandedDeposits'; content: string }
  | { variant: 'noStages' }
  | { variant: 'splitScaled' }

// Sized by how loud the alarm has to be for its surroundings, not by which alarm it is: `lg` sits in
// an etap header among controls, `sm` beside a table figure.
const SIZE = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' } as const

type LabelHintIconPropsT = LabelHintT & { size?: keyof typeof SIZE }

// The label-side counterpart to a value cell's `note`: a hover-only explanation icon beside a label.
// Cells take it as a prop (`hints`), so a row selects a variant instead of hand-rolling another
// HintTooltip+icon block inline and re-deciding icon, colour and aria-label each time.
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
