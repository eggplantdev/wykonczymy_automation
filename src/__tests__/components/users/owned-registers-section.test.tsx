import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OwnedRegistersSection } from '@/components/users/owned-registers-section'
import type { CashRegisterRefT } from '@/types/reference-data'

const REGISTER = { id: 1, name: 'Kasa główna', active: true, type: 'MAIN' } as CashRegisterRefT

describe('OwnedRegistersSection', () => {
  it('leaves a balance that renders as 0,00 zł uncoloured', () => {
    const { container } = render(
      <OwnedRegistersSection
        registers={[REGISTER]}
        balances={{ '1': -1e-13 }}
        linkable={false}
        locale="pl"
      />,
    )

    expect(container.querySelectorAll('.text-destructive')).toHaveLength(0)
  })
})
