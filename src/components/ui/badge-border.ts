import { COLOR_TOKEN_CLASSES, COLOR_TOKENS, type ColorTokenT } from '@/styles/color-tokens'

const CHART_BORDER_CLASS = {
  'chart-blue': 'border-chart-blue',
  'chart-yellow': 'border-chart-yellow',
  'chart-purple': 'border-chart-purple',
  'chart-teal': 'border-chart-teal',
  border: 'border-border',
} as const

const TOKEN_BORDER_CLASS = Object.fromEntries(
  COLOR_TOKENS.map((token) => [token, COLOR_TOKEN_CLASSES[token].border]),
) as Record<ColorTokenT, string>

export const BADGE_BORDER_CLASS = { ...TOKEN_BORDER_CLASS, ...CHART_BORDER_CLASS }

export type BadgeBorderT = keyof typeof BADGE_BORDER_CLASS
