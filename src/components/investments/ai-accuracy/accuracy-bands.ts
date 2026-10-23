export const ACCURACY_BANDS = [
  {
    id: 'good',
    min: 85,
    label: 'dobrze (85% i więcej)',
    color: 'var(--color-chart-green)',
    swatch: 'bg-chart-green',
    text: 'text-section-green-deep dark:text-chart-green',
  },
  {
    id: 'fair',
    min: 60,
    label: 'średnio (60–84%)',
    color: 'var(--color-chart-yellow)',
    swatch: 'bg-chart-yellow',
    text: 'text-section-yellow-deep dark:text-chart-yellow',
  },
  {
    id: 'poor',
    min: 0,
    label: 'słabo (poniżej 60%)',
    color: 'var(--color-chart-red)',
    swatch: 'bg-chart-red',
    text: 'text-destructive',
  },
] as const

export type AccuracyBandT = (typeof ACCURACY_BANDS)[number]

export const accuracyBand = (percent: number): AccuracyBandT =>
  ACCURACY_BANDS.find((band) => percent >= band.min) ?? ACCURACY_BANDS[2]
