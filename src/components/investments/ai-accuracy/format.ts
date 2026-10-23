import { formatPercent } from '@/lib/kosztorys/format'

const compactZloty = new Intl.NumberFormat('pl-PL', {
  notation: 'compact',
  maximumFractionDigits: 0,
})

export const formatWholePercent = (percent: number) => formatPercent(percent / 100)

export const formatCompactZloty = (zloty: number) => `${compactZloty.format(zloty)} zł`
