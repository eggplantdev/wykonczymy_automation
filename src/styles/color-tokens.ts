export const COLOR_TOKEN_CLASSES = {
  'muted-foreground': {
    border: 'border-muted-foreground',
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
  },
  'section-blue-soft': {
    border: 'border-section-blue-soft',
    dot: 'bg-section-blue-soft',
    text: 'text-section-blue-soft',
  },
  'section-blue': {
    border: 'border-section-blue',
    dot: 'bg-section-blue',
    text: 'text-section-blue',
  },
  'section-blue-deep': {
    border: 'border-section-blue-deep',
    dot: 'bg-section-blue-deep',
    text: 'text-section-blue-deep',
  },
  'section-turquoise-soft': {
    border: 'border-section-turquoise-soft',
    dot: 'bg-section-turquoise-soft',
    text: 'text-section-turquoise-soft',
  },
  'section-turquoise': {
    border: 'border-section-turquoise',
    dot: 'bg-section-turquoise',
    text: 'text-section-turquoise',
  },
  'section-turquoise-deep': {
    border: 'border-section-turquoise-deep',
    dot: 'bg-section-turquoise-deep',
    text: 'text-section-turquoise-deep',
  },
  'section-teal-soft': {
    border: 'border-section-teal-soft',
    dot: 'bg-section-teal-soft',
    text: 'text-section-teal-soft',
  },
  'section-teal': {
    border: 'border-section-teal',
    dot: 'bg-section-teal',
    text: 'text-section-teal',
  },
  'section-teal-deep': {
    border: 'border-section-teal-deep',
    dot: 'bg-section-teal-deep',
    text: 'text-section-teal-deep',
  },
  'section-green-soft': {
    border: 'border-section-green-soft',
    dot: 'bg-section-green-soft',
    text: 'text-section-green-soft',
  },
  'section-green': {
    border: 'border-section-green',
    dot: 'bg-section-green',
    text: 'text-section-green',
  },
  'section-green-deep': {
    border: 'border-section-green-deep',
    dot: 'bg-section-green-deep',
    text: 'text-section-green-deep',
  },
  'section-yellow-soft': {
    border: 'border-section-yellow-soft',
    dot: 'bg-section-yellow-soft',
    text: 'text-section-yellow-soft',
  },
  'section-yellow': {
    border: 'border-section-yellow',
    dot: 'bg-section-yellow',
    text: 'text-section-yellow',
  },
  'section-yellow-deep': {
    border: 'border-section-yellow-deep',
    dot: 'bg-section-yellow-deep',
    text: 'text-section-yellow-deep',
  },
  'section-orange-soft': {
    border: 'border-section-orange-soft',
    dot: 'bg-section-orange-soft',
    text: 'text-section-orange-soft',
  },
  'section-orange': {
    border: 'border-section-orange',
    dot: 'bg-section-orange',
    text: 'text-section-orange',
  },
  'section-orange-deep': {
    border: 'border-section-orange-deep',
    dot: 'bg-section-orange-deep',
    text: 'text-section-orange-deep',
  },
  'section-red-soft': {
    border: 'border-section-red-soft',
    dot: 'bg-section-red-soft',
    text: 'text-section-red-soft',
  },
  'section-red': { border: 'border-section-red', dot: 'bg-section-red', text: 'text-section-red' },
  'section-red-deep': {
    border: 'border-section-red-deep',
    dot: 'bg-section-red-deep',
    text: 'text-section-red-deep',
  },
  'section-pink-soft': {
    border: 'border-section-pink-soft',
    dot: 'bg-section-pink-soft',
    text: 'text-section-pink-soft',
  },
  'section-pink': {
    border: 'border-section-pink',
    dot: 'bg-section-pink',
    text: 'text-section-pink',
  },
  'section-pink-deep': {
    border: 'border-section-pink-deep',
    dot: 'bg-section-pink-deep',
    text: 'text-section-pink-deep',
  },
  'section-purple-soft': {
    border: 'border-section-purple-soft',
    dot: 'bg-section-purple-soft',
    text: 'text-section-purple-soft',
  },
  'section-purple': {
    border: 'border-section-purple',
    dot: 'bg-section-purple',
    text: 'text-section-purple',
  },
  'section-purple-deep': {
    border: 'border-section-purple-deep',
    dot: 'bg-section-purple-deep',
    text: 'text-section-purple-deep',
  },
  'transfer-red-warm': {
    border: 'border-transfer-red-warm',
    dot: 'bg-transfer-red-warm',
    text: 'text-transfer-red-warm',
  },
  'transfer-red-dark': {
    border: 'border-transfer-red-dark',
    dot: 'bg-transfer-red-dark',
    text: 'text-transfer-red-dark',
  },
  'transfer-fuchsia': {
    border: 'border-transfer-fuchsia',
    dot: 'bg-transfer-fuchsia',
    text: 'text-transfer-fuchsia',
  },
} as const

export type ColorTokenT = keyof typeof COLOR_TOKEN_CLASSES

export const COLOR_TOKENS = Object.keys(COLOR_TOKEN_CLASSES) as ColorTokenT[]
