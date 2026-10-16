import type { AddItemInputT } from '@/lib/actions/kosztorys'
import type { InsertDirectionT } from '@/lib/kosztorys/display-order'

const FIXTURE_DATA: AddItemInputT['data'] = {
  description: 'Praca testowa',
  category: '',
  unit: 'm2',
  clientPrice: 0,
  wToolsRate: null,
  wToolsRateCoeff: null,
  ownToolsRate: null,
  ownToolsRateCoeff: null,
}

export const appendAt = (sectionId: number): AddItemInputT => ({
  placement: { kind: 'end', sectionId },
  data: FIXTURE_DATA,
  catalogue: null,
})

export const insertNextTo = (anchorItemId: number, dir: InsertDirectionT): AddItemInputT => ({
  placement: { kind: 'next-to', anchorItemId, dir },
  data: FIXTURE_DATA,
  catalogue: null,
})
