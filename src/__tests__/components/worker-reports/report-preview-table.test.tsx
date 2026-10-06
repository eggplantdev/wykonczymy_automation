import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ReportPreviewTable } from '@/components/worker-reports/report-preview-table'
import type { ReportPreviewLineT } from '@/lib/kosztorys/worker-report/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))

const line = (patch: Partial<ReportPreviewLineT>): ReportPreviewLineT => ({
  id: 1,
  kind: 'rozpiska',
  ref: 4,
  scannedRef: undefined,
  sectionName: 'Salon',
  sectionColor: null,
  description: 'Malowanie ścian',
  workerDescription: undefined,
  workerDescriptionLanguage: undefined,
  unit: 'm2',
  reportedQty: 12,
  outcome: { kind: 'pending' },
  ...patch,
})

describe('ReportPreviewTable', () => {
  it('renders each Przyjęto state: waiting, the accepted qty, rejected', () => {
    render(
      <ReportPreviewTable
        group="rozpiska"
        lines={[
          line({ id: 1, description: 'Czeka', outcome: { kind: 'pending' } }),
          line({ id: 2, description: 'Przyjęta', outcome: { kind: 'accepted', qty: 7.5 } }),
          line({ id: 3, description: 'Odrzucona', outcome: { kind: 'rejected' } }),
        ]}
      />,
    )

    const rowOf = (description: string) => screen.getByText(description).closest('tr')
    expect(rowOf('Czeka')).toHaveTextContent('czeka')
    expect(rowOf('Przyjęta')).toHaveTextContent('7,5')
    expect(rowOf('Odrzucona')).toHaveTextContent('odrzucona')
  })

  it('shows the worker-language column only when a line carries one', () => {
    const { rerender } = render(<ReportPreviewTable group="rozpiska" lines={[line({})]} />)
    expect(screen.queryByText('Opis w języku pracownika')).toBeNull()

    rerender(
      <ReportPreviewTable
        group="rozpiska"
        lines={[line({ workerDescription: 'Фарбування стін', workerDescriptionLanguage: 'uk' })]}
      />,
    )
    expect(screen.getByText('Opis w języku pracownika')).toBeInTheDocument()
    expect(screen.getByText('Фарбування стін')).toBeInTheDocument()
  })
})
