import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PreviewHeaderActions } from '@/components/kosztorys/editor/preview-header-actions'
import type { InvestorHistoryT } from '@/lib/kosztorys/history/types'

async function openOptions(history?: InvestorHistoryT) {
  render(
    <PreviewHeaderActions
      history={history}
      hasRows
      emptyRowCount={1}
      showAllRows={false}
      onShowAllRowsChange={() => {}}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: /Opcje/ }))
  return screen.getByRole('menu')
}

describe('PreviewHeaderActions', () => {
  it('offers „Zobacz historię zmian" beside the rows toggle when handed a history', async () => {
    const menu = await openOptions({ entries: [], version: null })
    expect(menu).toHaveTextContent('Zobacz historię zmian')
    expect(menu).toHaveTextContent('Pokaż wszystkie pozycje')
  })

  it('offers only the rows toggle without one', async () => {
    const menu = await openOptions()
    expect(menu).toHaveTextContent('Pokaż wszystkie pozycje')
    expect(menu).not.toHaveTextContent('Zobacz historię zmian')
  })
})
