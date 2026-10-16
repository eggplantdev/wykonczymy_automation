import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// `max-w-dialog*` are project tokens from `@theme`, so plain `twMerge` left them NEXT TO an override
// instead of dropping one
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'max-w': [
        'max-w-dialog',
        'max-w-dialog-sm',
        'max-w-dialog-lg',
        'max-w-dialog-xl',
        'max-w-dialog-2xl',
        'max-w-dialog-3xl',
      ],
      'font-size': ['text-2xs', 'text-3xs', 'grid-cell-text', 'grid-band-text'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
