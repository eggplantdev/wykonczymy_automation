import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge knows Tailwind's own scale, not ours. `max-w-dialog*` are project tokens from
// `@theme`, so plain `twMerge` left them NEXT TO an override instead of dropping one — and the
// loser was decided by stylesheet order, where `--container-dialog*` sits after the stock
// `--container-*`. Net effect: `sm:max-w-5xl` on a DialogContent was silently a no-op, and three
// consecutive attempts to widen a window changed nothing on screen.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'max-w': ['max-w-dialog', 'max-w-dialog-sm', 'max-w-dialog-lg', 'max-w-dialog-xl'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
