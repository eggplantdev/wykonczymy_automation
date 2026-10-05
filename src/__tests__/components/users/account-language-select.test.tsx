import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountLanguageSelect } from '@/components/users/account-language-select'
import { changeOwnLanguageAction } from '@/lib/actions/account-language'
import { toastMessage } from '@/lib/utils/toast'

vi.mock('@/lib/actions/account-language', () => ({ changeOwnLanguageAction: vi.fn() }))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const USER_ID = 7
const REPORT_KEY = `worker-report-lang:${USER_ID}`

async function pick(name: string) {
  await userEvent.click(screen.getByRole('combobox'))
  await userEvent.click(screen.getByRole('option', { name }))
}

beforeEach(() => {
  window.localStorage.clear()
  vi.mocked(changeOwnLanguageAction).mockReset()
  vi.mocked(toastMessage).mockReset()
})

describe('AccountLanguageSelect', () => {
  it('a saved language also becomes the report’s choice on this device', async () => {
    window.localStorage.setItem(REPORT_KEY, 'pl')
    vi.mocked(changeOwnLanguageAction).mockResolvedValue({ success: true })
    render(<AccountLanguageSelect userId={USER_ID} language="pl" />)

    await pick('Українська')

    expect(changeOwnLanguageAction).toHaveBeenCalledWith('uk')
    await waitFor(() => expect(window.localStorage.getItem(REPORT_KEY)).toBe('uk'))
  })

  it('a refused save leaves the report’s choice alone and shows the old language', async () => {
    window.localStorage.setItem(REPORT_KEY, 'ru')
    vi.mocked(changeOwnLanguageAction).mockResolvedValue({ success: false, error: 'Błąd zapisu' })
    render(<AccountLanguageSelect userId={USER_ID} language="pl" />)

    await pick('Українська')

    await waitFor(() => expect(toastMessage).toHaveBeenCalledWith('Błąd zapisu', 'error', 6000))
    expect(window.localStorage.getItem(REPORT_KEY)).toBe('ru')
    expect(screen.getByRole('combobox')).toHaveTextContent('Polski')
  })
})
