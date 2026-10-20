import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SubcontractorWorkerTotals } from '@/components/kosztorys/summary/blocks/subcontractor-worker-totals'

describe('SubcontractorWorkerTotals', () => {
  it('does not flag a remainder that renders as 0,00 as overpaid', () => {
    const { container } = render(
      <SubcontractorWorkerTotals
        investmentId={4}
        investmentName="Test"
        rows={[
          {
            workerId: 1,
            name: 'Anna',
            due: 1_000,
            bonus: 0,
            paid: 1_000,
            remaining: -1e-13,
            state: 'settled',
          },
        ]}
      />,
    )

    expect(container.querySelectorAll('.text-destructive')).toHaveLength(0)
    expect(screen.queryByText('nadpłacone')).toBeNull()
  })
})
