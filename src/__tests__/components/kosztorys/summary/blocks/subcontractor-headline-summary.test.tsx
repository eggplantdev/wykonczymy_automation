import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SubcontractorHeadlineSummary } from '@/components/kosztorys/summary/blocks/subcontractor-headline-summary'
import type { SubcontractorDueByPlaneT } from '@/lib/kosztorys/subcontractor-due'

const DUE = {
  wTools: 1_000,
  ownTools: 0,
  combined: 1_000,
  hasUnconfirmedPlane: false,
} as SubcontractorDueByPlaneT

describe('SubcontractorHeadlineSummary', () => {
  it('leaves a remainder that renders as 0,00 uncoloured', () => {
    const { container } = render(
      <SubcontractorHeadlineSummary
        summary={{ dueNet: 1_000, bonusTotal: 0, payoutsTotal: 1_000, remaining: -1e-13, rows: [] }}
        due={DUE}
        showPlanes={false}
      />,
    )

    expect(container.querySelectorAll('.text-destructive')).toHaveLength(0)
  })
})
