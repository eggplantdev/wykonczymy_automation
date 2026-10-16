import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LocationCell } from '@/components/equipment/location-cell'
import { WarrantyCell } from '@/components/equipment/warranty-cell'

// The table drops to 12px on a phone (`text-sm max-sm:text-xs`); a cell that restates `text-sm`
// stays 14px there while the rest of the row shrinks.
describe('equipment cells inherit the table font size', () => {
  it('the holder name in „Gdzie jest" sets no size of its own', () => {
    render(
      <LocationCell
        location={{ kind: 'holder', id: 1, name: 'Jan Testowy' }}
        locatedAt={null}
        live
      />,
    )
    expect(screen.getByText('Jan Testowy')).not.toHaveClass('text-sm')
  })

  it('the warranty date sets no size of its own', () => {
    render(<WarrantyCell warrantyUntil="2030-01-15" daysLeft={400} bucket={null} />)
    expect(screen.getByText('15.01.2030')).not.toHaveClass('text-sm')
  })
})
