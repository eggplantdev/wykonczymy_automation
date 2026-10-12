import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AiStageSelect } from '@/components/investments/ai-stage-select'
import { setInvestmentAiStageAction } from '@/lib/actions/investments'
import { toastMessage } from '@/lib/utils/toast'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/actions/investments', () => ({ setInvestmentAiStageAction: vi.fn() }))
vi.mock('@/lib/utils/log-error', () => ({ logError: vi.fn() }))

beforeEach(() => {
  vi.mocked(setInvestmentAiStageAction).mockReset()
  vi.mocked(toastMessage).mockReset()
})

async function pick(label: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox'))
  // An option's accessible name runs on into the description printed under its title.
  await user.click(await screen.findByRole('option', { name: (name) => name.startsWith(label) }))
}

describe('AiStageSelect', () => {
  it('saves „Uzupełnianie informacji” as no stage', async () => {
    vi.mocked(setInvestmentAiStageAction).mockResolvedValue({ success: true })
    render(<AiStageSelect investmentId={7} aiStage="review_done" />)

    await pick('Uzupełnianie informacji')

    expect(setInvestmentAiStageAction).toHaveBeenCalledWith(7, null)
    await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled())
    expect(toastMessage).not.toHaveBeenCalled()
  })

  it('reverts and says so when the request itself fails', async () => {
    vi.mocked(setInvestmentAiStageAction).mockRejectedValue(new TypeError('Failed to fetch'))
    render(<AiStageSelect investmentId={7} aiStage="ready_for_analysis" />)

    await pick('Recenzja zakończona')

    await waitFor(() => expect(toastMessage).toHaveBeenCalledWith(expect.any(String), 'error'))
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('Gotowa do analizy'))
  })
})
