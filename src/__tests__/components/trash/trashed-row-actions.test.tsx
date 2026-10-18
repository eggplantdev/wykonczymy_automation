import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TrashedRowActions } from '@/components/trash/trashed-row-actions'
import type { TrashRowT } from '@/types/trash'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const row = (overrides: Partial<TrashRowT>): TrashRowT => ({
  kind: 'file',
  id: 5,
  name: 'faktura.pdf',
  trashedAt: new Date('2026-10-15T10:00:00Z'),
  daysLeft: 4,
  autoPurges: true,
  hasSheet: false,
  pairedRegisters: [],
  ...overrides,
})

describe('TrashedRowActions', () => {
  it('offers a file only restoring, never deleting forever', () => {
    render(<TrashedRowActions row={row({})} />)

    expect(screen.getByRole('button', { name: /Przywróć/ })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /na zawsze/ })).not.toBeInTheDocument()
  })

  it('disables restoring while the file’s source lies in the trash', () => {
    render(
      <TrashedRowActions
        row={row({ restoreBlockedReason: 'Najpierw przywróć inwestycję z Kosza.' })}
      />,
    )

    expect(screen.getByRole('button', { name: /Przywróć/ })).toBeDisabled()
  })

  it('keeps deleting forever for a kind that has it', () => {
    render(<TrashedRowActions row={row({ kind: 'vehicle', name: 'WX 1' })} />)

    expect(screen.getByRole('button', { name: /na zawsze/ })).toBeInTheDocument()
  })
})
