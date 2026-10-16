import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InspectionForm } from '@/components/forms/inspection-form/inspection-form'
import { useInspectionFormStore } from '@/stores/form-stores'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { formatKm } from '@/lib/utils/format-distance'
import type {
  InspectionFormDataT,
  InspectionFormValuesT,
} from '@/components/forms/inspection-form/inspection-schema'
import type { ActionResultT } from '@/types/action'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const VEHICLE = {
  id: 7,
  registration: 'WX 1234A',
  make: 'Ford',
  model: 'Transit',
  latestOdometer: 120_000,
}

const PERFORMED_AT = '2026-03-10'

const DEFAULTS: InspectionFormValuesT = {
  vehicle: String(VEHICLE.id),
  type: 'TECHNICAL',
  performedAt: PERFORMED_AT,
  // What the dialog seeds for the type it opens on: TECHNICAL is a 12-month interval.
  nextDueAt: '2027-03-10',
  odometer: '',
  cost: '',
  insurer: '',
  policyNumber: '',
  note: '',
}

const action = vi.fn<(data: InspectionFormDataT) => Promise<ActionResultT>>(async () => ({
  success: true,
}))

// A fresh draft slot per test: the store is module-global and its write debounced, so a previous
// test's draft lands after `resetFormData` and is restored as this one's initial values.
let draftSlot = 0

function renderForm(formId?: string) {
  draftSlot += 1
  // keepOpen, because that is the branch that awaits the action inline.
  render(
    <InspectionForm
      formId={formId ?? `inspection-${draftSlot}`}
      defaultValues={DEFAULTS}
      lockedVehicleId={VEHICLE.id}
      action={action}
      successMessage="Przegląd zapisany"
      submitLabel="Zapisz"
      submittingLabel="Zapisywanie..."
      onSubmitSuccess={vi.fn()}
      keepOpen
      vehicles={[VEHICLE]}
    />,
  )
  return userEvent.setup()
}

type UserT = ReturnType<typeof userEvent.setup>

async function pickType(user: UserT, label: string): Promise<void> {
  await user.click(screen.getByRole('combobox', { name: /Rodzaj/i }))
  await user.click(await screen.findByRole('option', { name: label }))
}

const nextDue = () => screen.queryByLabelText('Następny termin')

// The calendar opens on the month of the date already in the field, so the day picked here has to
// live in that month.
async function pickNextDue(user: UserT, isoDate: string): Promise<void> {
  await user.click(screen.getByLabelText('Następny termin'))
  const cell = document.querySelector<HTMLElement>(`[data-day="${isoDate}"]`)
  if (!cell) throw new Error(`no ${isoDate} cell in the open calendar`)
  await user.click(within(cell).getByRole('button'))
}

beforeEach(() => {
  vi.clearAllMocks()
  useInspectionFormStore.getState().resetFormData()
  useOptimisticFormStore.setState({ keepOpen: true })
})

describe('Przegląd — rodzaj przestawia resztę formularza', () => {
  it('podpowiada termin z interwału przy każdej zmianie rodzaju, nie tylko pierwszej', async () => {
    const user = renderForm()

    await pickType(user, 'Przegląd gwarancyjny')
    expect(nextDue(), 'gwarancja to 24 miesiące').toHaveTextContent('10 mar 2028')

    // The second change is the guard: the prefill writes the field itself, so a write that counted
    // as „the user touched it" would freeze the suggestion on whatever the first pick suggested.
    await pickType(user, 'OC')
    expect(nextDue(), 'OC to 12 miesięcy').toHaveTextContent('10 mar 2027')

    await pickType(user, 'Wymiana opon')
    expect(nextDue()).toHaveTextContent('Wybierz datę')
  })

  it('nie rusza terminu, który użytkownik wybrał sam', async () => {
    const user = renderForm()

    await pickNextDue(user, '2027-03-20')
    await waitFor(() => expect(nextDue()).toHaveTextContent('20 mar 2027'))

    await pickType(user, 'Przegląd gwarancyjny')
    expect(nextDue(), 'ręcznie wybrany termin').toHaveTextContent('20 mar 2027')
  })

  it('„Odczyt licznika" chowa i czyści termin oraz koszt', async () => {
    const user = renderForm()

    await user.type(screen.getByLabelText(/Koszt/i), '300')
    await pickNextDue(user, '2027-03-20')

    await pickType(user, 'Odczyt licznika')
    expect(nextDue(), 'termin przy odczycie licznika').not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/Koszt/i),
      'koszt przy odczycie licznika',
    ).not.toBeInTheDocument()

    await pickType(user, 'Przegląd techniczny')
    expect(screen.getByLabelText(/Koszt/i)).toHaveValue('')
    expect(nextDue()).toHaveTextContent('10 mar 2027')
  })

  it('zmiana rodzaju z OC czyści dane polisy', async () => {
    const user = renderForm()

    await pickType(user, 'OC')
    await user.type(screen.getByLabelText(/Ubezpieczyciel/i), 'PZU')
    await user.type(screen.getByLabelText(/Nr polisy/i), '354E000003305')

    await pickType(user, 'Przegląd techniczny')
    await pickType(user, 'OC')

    expect(screen.getByLabelText(/Ubezpieczyciel/i)).toHaveValue('')
    expect(screen.getByLabelText(/Nr polisy/i)).toHaveValue('')
  })
})

// The suggestion is gated on the form's own last suggestion, so anything writing „Następny termin"
// from outside `prefillNextDue` desynchronises the gate — which then silently refuses every
// suggestion from then on.
describe('Przegląd — termin po ponownym otwarciu formularza', () => {
  it('podpowiada dalej po zapisie z otwartym dialogiem', async () => {
    const user = renderForm()

    // „Wymiana opon" has no interval, so the suggestion it leaves behind is an empty field — and
    // that empty string is what the form remembers having suggested.
    await pickType(user, 'Wymiana opon')
    expect(nextDue()).toHaveTextContent('Wybierz datę')

    await user.click(screen.getByRole('button', { name: 'Zapisz' }))
    expect(action).toHaveBeenCalledTimes(1)

    await screen.findByText('10 mar 2027')

    await pickType(user, 'Przegląd gwarancyjny')
    expect(nextDue(), 'gwarancja po zapisie z keepOpen').toHaveTextContent('10 mar 2028')
  })

  it('podpowiada dalej po przywróceniu szkicu', async () => {
    const formId = 'inspection-draft-restore'
    useInspectionFormStore
      .getState()
      .updateFormData(formId, { ...DEFAULTS, type: 'WARRANTY', nextDueAt: '2028-03-10' })

    const user = renderForm(formId)
    expect(nextDue()).toHaveTextContent('10 mar 2028')

    await pickType(user, 'Przegląd techniczny')
    expect(nextDue(), 'termin po korekcie rodzaju w przywróconym szkicu').toHaveTextContent(
      '10 mar 2027',
    )
  })
})

describe('Przegląd — niższy przebieg niż ostatni zapisany', () => {
  it('ostrzega o cofniętym liczniku, ale zapisuje', async () => {
    const user = renderForm()

    await user.type(screen.getByLabelText(/Przebieg/i), '90000')
    // The same formatter the cell uses, minus the nbsp pl-PL groups thousands with — jest-dom
    // normalizes it away on the received side before comparing.
    expect(screen.getByText(/Ostatni zapisany przebieg/)).toHaveTextContent(
      formatKm(VEHICLE.latestOdometer).replace(/\u00a0/g, ' '),
    )

    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    expect(action).toHaveBeenCalledTimes(1)
    expect(action.mock.calls[0]?.[0]).toMatchObject({ vehicle: VEHICLE.id, odometer: 90_000 })
  })

  it('milczy, dopóki odczyt nie jest niższy', async () => {
    const user = renderForm()

    await user.type(screen.getByLabelText(/Przebieg/i), '130000')
    expect(screen.queryByText(/Ostatni zapisany przebieg/)).not.toBeInTheDocument()
  })
})
