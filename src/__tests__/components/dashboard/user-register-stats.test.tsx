import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UserRegisterStats } from '@/components/dashboard/user-register-stats'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { useCurrentUser as currentUserStub } from '@/__tests__/stubs/use-current-user'
import { useCurrentUser } from '@/hooks/use-current-user'
import type { CashRegisterRowT } from '@/types/table-rows'

vi.mocked(useCurrentUser).mockImplementation(currentUserStub)

const register = (id: number, name: string, ownerId: number): CashRegisterRowT => ({
  id,
  name,
  ownerName: 'Testowy',
  ownerId,
  balance: 100,
  type: 'MAIN',
  active: true,
})

describe('UserRegisterStats', () => {
  it('lists only the registers the signed-in account owns, even when another owner has the same name', () => {
    authState.userId = 7
    render(
      <UserRegisterStats
        cashRegisters={[register(1, 'Kasa własna', 7), register(2, 'Kasa imiennika', 8)]}
      />,
    )

    expect(screen.getByText('Kasa własna:')).toBeInTheDocument()
    expect(screen.queryByText('Kasa imiennika:')).not.toBeInTheDocument()
  })
})
