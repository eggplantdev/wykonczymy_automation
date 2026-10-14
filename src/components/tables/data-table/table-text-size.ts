export const TABLE_TEXT_SIZES = ['2xs', 'xs', 'sm', 'base'] as const

export type TableTextSizeT = (typeof TABLE_TEXT_SIZES)[number]

type TextSizeClassesT = { body: string; header: string; headerDescription: string }

// The header's description stays one step below the header, so a smaller table keeps its hierarchy.
export const TABLE_TEXT_SIZE = {
  '2xs': { body: 'text-2xs', header: 'text-2xs', headerDescription: 'text-3xs' },
  xs: { body: 'text-xs', header: 'text-xs', headerDescription: 'text-2xs' },
  sm: { body: 'text-sm max-sm:text-xs', header: 'text-sm', headerDescription: 'text-xs' },
  base: { body: 'text-base max-sm:text-sm', header: 'text-base', headerDescription: 'text-sm' },
} as const satisfies Record<TableTextSizeT, TextSizeClassesT>

export const isTableTextSize = (value: unknown): value is TableTextSizeT =>
  typeof value === 'string' && Object.hasOwn(TABLE_TEXT_SIZE, value)
