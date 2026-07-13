'use client'

import { createPortal } from 'react-dom'
import { GradientSpinner } from '@/components/ui/gradient-spinner'

type SubmitPillPropsT = {
  label: string
}

// Fixed, non-blocking bottom-center pill in the app's fuchsia→cyan AI-accent language. Signals
// any in-flight background work on a form (optimistic submit, receipt generation) without blocking
// interaction. Driven by whatever flag the caller passes; it holds no state of its own.
//
// Portaled to document.body so it anchors to the viewport like the toasts do — a `fixed` element
// rendered inside the dialog would instead anchor to the dialog's transformed content box (a
// transformed ancestor becomes the containing block for `position: fixed`).
export function SubmitPill({ label }: SubmitPillPropsT) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="gradient-border neon-glow-duo fixed bottom-6 left-1/2 z-100000000 flex -translate-x-1/2 items-center gap-3 rounded-full px-5 py-3 text-sm font-medium"
    >
      <GradientSpinner />
      {label}
    </div>,
    document.body,
  )
}
