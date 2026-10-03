export const makeModel = (item: { make: string; model: string }): string =>
  [item.make, item.model].filter(Boolean).join(' ')
