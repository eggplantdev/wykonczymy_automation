import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AddItemsFromCatalogueDialog } from '@/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog'
import type { SectionSubtotalT } from '@/lib/kosztorys/types'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const insertCatalogueItemsAction = vi.fn()
const createSectionWithCatalogueItemsAction = vi.fn()

vi.mock('@/lib/actions/work-catalogue', () => ({
  insertCatalogueItemsAction: (...args: unknown[]) => insertCatalogueItemsAction(...args),
  createSectionWithCatalogueItemsAction: (...args: unknown[]) =>
    createSectionWithCatalogueItemsAction(...args),
}))

const CATALOGUE: WorkCatalogueItemT[] = [
  {
    id: 11,
    description: 'Malowanie ścian',
    category: 'Malarskie',
    unit: 'm2',
    clientPrice: 50,
    wToolsRate: 20,
    wToolsRateCoeff: null,
    ownToolsRate: 15,
    ownToolsRateCoeff: null,
    matchKey: 'malowanie scian|m2',
  },
]

vi.mock('@/components/kosztorys/editor/dialogs/use-work-catalogue', () => ({
  useWorkCatalogue: () => ({ catalogue: CATALOGUE }),
}))

// DataTable's row reaches for the app router, which jsdom has no mount for.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

const section = (sectionId: number, sectionName: string): SectionSubtotalT => ({
  sectionId,
  sectionName,
  sectionColor: null,
  net: 0,
  plannedNet: 0,
  discount: 0,
  share: 0,
  completionRatio: null,
  itemCount: 0,
})

const SECTIONS = [section(1, 'Łazienka'), section(2, 'Kuchnia')]

const SLICE = {
  section: { id: 9, name: 'x', displayOrder: 0, color: null, items: [] },
  warnings: [],
}

function renderDialog() {
  return render(
    <AddItemsFromCatalogueDialog
      investmentId={7}
      sections={SECTIONS}
      kosztorysItems={[]}
      open
      onOpenChange={vi.fn()}
      onInserted={vi.fn()}
    />,
  )
}

async function pickTheWork(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: 'Malowanie ścian' }))
}

async function openSectionPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox', { name: 'Wybierz lub wpisz sekcję…' }))
}

describe('AddItemsFromCatalogueDialog — „Dodaj do:"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertCatalogueItemsAction.mockResolvedValue({ success: true, data: SLICE })
    createSectionWithCatalogueItemsAction.mockResolvedValue({
      success: true,
      data: { ...SLICE, createdSection: true },
    })
  })

  it('nie pozwala dodać, dopóki sekcja nie jest wskazana', async () => {
    const user = userEvent.setup()
    renderDialog()
    await pickTheWork(user)

    expect(screen.getByRole('button', { name: 'Dodaj (1)' })).toBeDisabled()
  })

  it('wpisana nazwa spoza listy zakłada nową sekcję', async () => {
    const user = userEvent.setup()
    renderDialog()
    await pickTheWork(user)

    await openSectionPicker(user)
    await user.type(screen.getByPlaceholderText('Wybierz lub wpisz sekcję…'), 'Salon')
    await user.click(screen.getByRole('button', { name: 'Dodaj „Salon”' }))
    await user.click(screen.getByRole('button', { name: 'Dodaj (1)' }))

    expect(createSectionWithCatalogueItemsAction).toHaveBeenCalledWith(7, 'Salon', [11])
    expect(insertCatalogueItemsAction).not.toHaveBeenCalled()
  })

  it('wybrana sekcja z listy dopisuje do niej, bez zakładania nowej', async () => {
    const user = userEvent.setup()
    renderDialog()
    await pickTheWork(user)

    await openSectionPicker(user)
    await user.click(screen.getByRole('button', { name: 'Kuchnia' }))
    await user.click(screen.getByRole('button', { name: 'Dodaj (1)' }))

    expect(insertCatalogueItemsAction).toHaveBeenCalledWith(2, [11])
    expect(createSectionWithCatalogueItemsAction).not.toHaveBeenCalled()
  })

  it('wpisana nazwa istniejącej sekcji trafia w tę sekcję, nie w nową', async () => {
    const user = userEvent.setup()
    renderDialog()
    await pickTheWork(user)

    await openSectionPicker(user)
    // Case is the only difference, so to the owner this is the same sekcja — «Dodaj „łazienka”»
    // must not appear at all.
    await user.type(screen.getByPlaceholderText('Wybierz lub wpisz sekcję…'), 'łazienka')
    expect(screen.queryByRole('button', { name: 'Dodaj „łazienka”' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Łazienka' }))
    await user.click(screen.getByRole('button', { name: 'Dodaj (1)' }))

    expect(insertCatalogueItemsAction).toHaveBeenCalledWith(1, [11])
    expect(createSectionWithCatalogueItemsAction).not.toHaveBeenCalled()
  })
})
