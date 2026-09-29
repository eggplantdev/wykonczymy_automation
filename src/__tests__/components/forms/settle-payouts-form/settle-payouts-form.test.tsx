import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SettlePayoutsForm } from '@/components/forms/settle-payouts-form/settle-payouts-form'
import { settlePayoutsAction } from '@/lib/actions/settle-payouts'
import { BLOCKED_PAIR_REASON, type SettleRowT } from '@/lib/kosztorys/worker-payout-pairs'
import { formatPLN } from '@/lib/utils/format-currency'
import { bare } from '@/__tests__/helpers/money'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/actions/settle-payouts', () => ({ settlePayoutsAction: vi.fn() }))

const row = (overrides: Partial<SettleRowT>): SettleRowT => ({
  investmentId: 1,
  workerId: 10,
  label: 'Akacjowa',
  due: 1000,
  paid: 200,
  remaining: 800,
  state: 'payable',
  ...overrides,
})

const ROWS: SettleRowT[] = [
  row({}),
  row({
    investmentId: 2,
    label: 'Brzozowa',
    due: 500,
    paid: 700,
    remaining: -200,
    state: 'overpaid',
  }),
  row({ investmentId: 3, label: 'Cisowa', remaining: 300, state: 'locked' }),
  row({ investmentId: 4, label: 'Dębowa', remaining: 0, state: 'withheld' }),
]

function renderForm(rows = ROWS, reloadRows = vi.fn(async () => rows)) {
  const onSubmitSuccess = vi.fn()
  render(
    <SettlePayoutsForm
      initialRows={rows}
      reloadRows={reloadRows}
      cashRegisters={[{ id: 5, name: 'Kasa główna', type: 'MAIN', active: true }]}
      defaultCashRegisterId={5}
      labelHeader="Inwestycja"
      onSubmitSuccess={onSubmitSuccess}
    />,
  )
  return { onSubmitSuccess, reloadRows }
}

const rowOf = (label: string) => within(screen.getByText(label).closest('tr')!)
const tick = (label: string) => screen.getByRole('checkbox', { name: `Wypłać: ${label}` })
const amount = (label: string) => screen.getByRole('textbox', { name: `Kwota wypłaty: ${label}` })
const submit = () => screen.getByRole('button', { name: 'Wypłać' })
const razem = () => bare(screen.getByText('Razem').closest('tr')!.textContent ?? '')

beforeEach(() => {
  vi.mocked(settlePayoutsAction).mockReset()
})

describe('SettlePayoutsForm', () => {
  it('prefills a payable row with its remaining and leaves a nadpłata unticked and empty', () => {
    renderForm()
    expect(tick('Akacjowa')).toBeChecked()
    expect(amount('Akacjowa')).toHaveValue('800')
    expect(tick('Brzozowa')).not.toBeChecked()
    expect(amount('Brzozowa')).toHaveValue('')
  })

  it('shows what was executed and what was paid beside the remaining', () => {
    renderForm()
    const cells = bare(screen.getByText('Brzozowa').closest('tr')!.textContent ?? '')
    expect(cells).toContain(bare(formatPLN(500)))
    expect(cells).toContain(bare(formatPLN(700)))
  })

  it('reads „zostanie / rozliczone / nadpłata" live from the typed amount', async () => {
    const user = userEvent.setup()
    renderForm()
    const input = amount('Akacjowa')

    expect(rowOf('Akacjowa').getByText('rozliczone')).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '500')
    expect(bare(rowOf('Akacjowa').getByText(/zostanie/).textContent!)).toBe(
      bare(`zostanie ${formatPLN(300)}`),
    )

    await user.clear(input)
    await user.type(input, '900')
    expect(bare(rowOf('Akacjowa').getByText(/^nadpłata/).textContent!)).toBe(
      bare(`nadpłata ${formatPLN(100)}`),
    )
  })

  it('warns about a zaliczka only on the row paid past its work', async () => {
    const user = userEvent.setup()
    renderForm()
    expect(screen.queryByText(/ponad wykonaną pracę/)).not.toBeInTheDocument()

    await user.clear(amount('Akacjowa'))
    await user.type(amount('Akacjowa'), '1000')
    expect(bare(rowOf('Akacjowa').getByText(/ponad wykonaną pracę/).textContent!)).toContain(
      bare(formatPLN(200)),
    )

    // A nadpłata row already paid past its work: the whole new amount is ahead, the old nadpłata is
    // not counted again.
    await user.click(tick('Brzozowa'))
    await user.type(amount('Brzozowa'), '150')
    expect(bare(rowOf('Brzozowa').getByText(/ponad wykonaną pracę/).textContent!)).toContain(
      bare(formatPLN(150)),
    )
  })

  it('sums only the ticked rows into Razem', async () => {
    const user = userEvent.setup()
    renderForm()
    expect(razem()).toContain(bare(formatPLN(800)))

    await user.click(tick('Brzozowa'))
    await user.type(amount('Brzozowa'), '50')
    expect(razem()).toContain(bare(formatPLN(850)))

    await user.click(tick('Akacjowa'))
    expect(razem()).toContain(bare(formatPLN(50)))
  })

  it('greys a blocked row out with its reason and does not let it be ticked', () => {
    renderForm()
    expect(tick('Cisowa')).toBeDisabled()
    expect(tick('Dębowa')).toBeDisabled()
    expect(rowOf('Cisowa').getByText(BLOCKED_PAIR_REASON.locked)).toBeInTheDocument()
    expect(rowOf('Dębowa').getByText(BLOCKED_PAIR_REASON.withheld)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Kwota wypłaty: Cisowa' })).not.toBeInTheDocument()
  })

  it('keeps submit disabled while nothing is ticked', async () => {
    const user = userEvent.setup()
    renderForm()
    expect(submit()).toBeEnabled()
    await user.click(tick('Akacjowa'))
    expect(submit()).toBeDisabled()
  })

  it('sends one row per ticked pair with the figure it showed', async () => {
    const user = userEvent.setup()
    vi.mocked(settlePayoutsAction).mockResolvedValue({ success: true })
    const { onSubmitSuccess } = renderForm()

    await user.click(tick('Brzozowa'))
    await user.type(amount('Brzozowa'), '150,5')
    await user.click(submit())

    await waitFor(() => expect(onSubmitSuccess).toHaveBeenCalledOnce())
    expect(settlePayoutsAction).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRegister: 5,
        rows: [
          { investmentId: 1, workerId: 10, amount: 800, expectedRemaining: 800 },
          { investmentId: 2, workerId: 10, amount: 150.5, expectedRemaining: -200 },
        ],
      }),
    )
  })

  it('reloads the rows in place when the figures moved, and stays open', async () => {
    const user = userEvent.setup()
    vi.mocked(settlePayoutsAction).mockResolvedValue({
      success: false,
      stale: true,
      error: 'Kwoty zmieniły się',
    })
    const fresh = [row({ remaining: 450, paid: 550 })]
    const { onSubmitSuccess, reloadRows } = renderForm(
      ROWS,
      vi.fn(async () => fresh),
    )

    await user.click(submit())

    await waitFor(() => expect(amount('Akacjowa')).toHaveValue('450'))
    expect(reloadRows).toHaveBeenCalledOnce()
    expect(screen.queryByText('Brzozowa')).not.toBeInTheDocument()
    expect(onSubmitSuccess).not.toHaveBeenCalled()
  })
})
