import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NewItemDialog } from '@/components/kosztorys/editor/dialogs/new-item/new-item-dialog'
import { addItemAction, type AddItemInputT } from '@/lib/actions/kosztorys'
import type { KosztorysItemT, NewItemPlacementT } from '@/lib/kosztorys/types'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/actions/kosztorys', () => ({ addItemAction: vi.fn() }))

const SECTION = 'Łazienka 1'
const COMBOBOX = 'Wybierz lub wpisz nową…'

const CATALOGUE_ENTRY: WorkCatalogueItemT = {
  id: 7,
  description: 'Malowanie ścian',
  descriptionTranslations: {},
  category: 'Wykończenia',
  unit: 'm²',
  clientPrice: 40,
  wToolsRate: 20,
  ownToolsRate: null,
  wToolsRateCoeff: null,
  ownToolsRateCoeff: null,
  matchKey: catalogueKey('Malowanie ścian', 'm²'),
}

const action = vi.mocked(addItemAction)
const sent = (call: number): AddItemInputT => action.mock.calls[call][0]

let nextId = 100
const savedItem = (input: AddItemInputT) =>
  ({ id: nextId++, description: input.data.description }) as KosztorysItemT

function renderDialog(placement: NewItemPlacementT = { kind: 'end', sectionId: 3 }) {
  const onPlaced = vi.fn()
  const onStaleTree = vi.fn()
  const onClose = vi.fn()
  render(
    <NewItemDialog
      placement={placement}
      sectionName={SECTION}
      anchorDescription="Skucie płytek"
      workCatalogue={[CATALOGUE_ENTRY]}
      kosztorysUnits={[]}
      onPlaced={onPlaced}
      onStaleTree={onStaleTree}
      onClose={onClose}
    />,
  )
  const user = userEvent.setup()

  const typeInto = async (combobox: HTMLElement, text: string) => {
    await user.click(combobox)
    await user.keyboard(text)
    await user.keyboard('{Enter}')
  }
  const fill = async (description = 'Malowanie ścian') => {
    await user.type(screen.getByLabelText('Opis pracy'), description)
    await typeInto(screen.getAllByRole('combobox', { name: COMBOBOX })[0], 'm²')
    await user.type(screen.getByLabelText('Cena j.m. (PLN)'), '50')
  }
  const tickCatalogue = () =>
    user.click(screen.getByRole('checkbox', { name: 'Dodaj pracę do katalogu prac' }))
  const save = () => user.click(screen.getByRole('button', { name: 'Dodaj' }))

  return { user, onPlaced, onStaleTree, onClose, typeInto, fill, tickCatalogue, save }
}

beforeEach(() => {
  vi.clearAllMocks()
  action.mockImplementation(async (input) => ({ success: true, data: { item: savedItem(input) } }))
})

describe('NewItemDialog — kategoria', () => {
  it('shows kategoria only once the katalog checkbox is ticked, prefilled from the sekcja', async () => {
    const { tickCatalogue } = renderDialog()

    expect(screen.queryByText('Kategoria')).not.toBeInTheDocument()
    await tickCatalogue()

    expect(screen.getByText('Kategoria')).toBeInTheDocument()
    expect(screen.getAllByRole('combobox', { name: COMBOBOX })[1]).toHaveTextContent(/^Łazienka$/)
  })

  it('sends no katalog write and no kategoria once the checkbox is unticked again', async () => {
    const { fill, tickCatalogue, save } = renderDialog()

    await fill('Nowa praca testowa')
    await tickCatalogue()
    await tickCatalogue()
    await save()

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(sent(0).catalogue).toBeNull()
    expect(sent(0).data.category).toBe('')
  })

  it('sends „auto" stawki as empty columns', async () => {
    const { fill, save } = renderDialog()

    await fill('Nowa praca testowa')
    await save()

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(sent(0).data).toMatchObject({
      clientPrice: 50,
      wToolsRate: null,
      wToolsRateCoeff: null,
      ownToolsRate: null,
      ownToolsRateCoeff: null,
    })
  })

  it('writes a new katalog entry when opis + j.m. is not in the katalog yet', async () => {
    const { fill, tickCatalogue, save } = renderDialog()

    await fill('Nowa praca testowa')
    await tickCatalogue()
    await save()

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(sent(0).catalogue).toEqual({ mode: 'new', keepCatalogueCategory: true })
    expect(sent(0).data.category).toBe('Łazienka')
  })
})

describe('NewItemDialog — anchor praca gone', () => {
  it('hands a NOT_FOUND to the stale-tree recovery and closes', async () => {
    action.mockResolvedValueOnce({ success: false, error: 'Nie znaleziono.', code: 'NOT_FOUND' })
    const { fill, save, onStaleTree, onClose, onPlaced } = renderDialog({
      kind: 'next-to',
      anchorItemId: 5,
      dir: 'below',
    })

    await fill('Nowa praca testowa')
    await save()

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onStaleTree).toHaveBeenCalledTimes(1)
    expect(onPlaced).not.toHaveBeenCalled()
  })

  it('keeps the dialog open on any other failure', async () => {
    action.mockResolvedValueOnce({ success: false, error: 'Błąd zapisu.' })
    const { fill, save, onStaleTree, onClose } = renderDialog()

    await fill('Nowa praca testowa')
    await save()

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(onStaleTree).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('NewItemDialog — praca already in the katalog', () => {
  const collide = async () => {
    const rendered = renderDialog()
    await rendered.fill()
    await rendered.tickCatalogue()
    await rendered.save()
    await screen.findByText('„Malowanie ścian" jest już w katalogu')
    return rendered
  }

  it('„Wróć" sends nothing and leaves the form filled', async () => {
    const { user } = await collide()

    await user.click(screen.getByRole('button', { name: 'Wróć' }))

    expect(screen.queryByText(/jest już w katalogu/)).not.toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Opis pracy')).toHaveValue('Malowanie ścian')
  })

  it('Escape reads as „Wróć"', async () => {
    const { user } = await collide()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByText(/jest już w katalogu/)).not.toBeInTheDocument())
    expect(action).not.toHaveBeenCalled()
  })

  it('a click on the overlay reads as „Wróć"', async () => {
    await collide()

    const overlays = document.querySelectorAll('.fixed.inset-0.bg-black\\/50')
    fireEvent.click(overlays[overlays.length - 1])

    await waitFor(() => expect(screen.queryByText(/jest już w katalogu/)).not.toBeInTheDocument())
    expect(action).not.toHaveBeenCalled()
  })

  it('„Tylko do kosztorysu" adds the praca without touching the katalog', async () => {
    const { user } = await collide()

    await user.click(screen.getByRole('button', { name: 'Tylko do kosztorysu' }))

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(sent(0).catalogue).toBeNull()
  })

  it('„Nadpisz w katalogu" overwrites and keeps the katalog kategoria by default', async () => {
    const { user } = await collide()

    expect(screen.getByRole('checkbox', { name: 'Zostaw kategorię z katalogu' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Nadpisz w katalogu' }))

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(sent(0).catalogue).toEqual({ mode: 'overwrite', keepCatalogueCategory: true })
  })
})

describe('NewItemDialog — „Nie zamykaj po zapisaniu"', () => {
  const keepOpen = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('checkbox', { name: 'Nie zamykaj po zapisaniu' }))

  it('resets the form and puts the next praca under the one just saved', async () => {
    const { user, fill, save, onClose, onPlaced } = renderDialog({
      kind: 'next-to',
      anchorItemId: 5,
      dir: 'above',
    })

    await keepOpen(user)
    await fill('Pierwsza praca')
    await save()
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    const first = onPlaced.mock.calls[0][0] as KosztorysItemT

    await waitFor(() => expect(screen.getByLabelText('Opis pracy')).toHaveValue(''))
    expect(screen.getByText('Praca trafi pod „Pierwsza praca".')).toBeInTheDocument()

    await fill('Druga praca')
    await save()

    await waitFor(() => expect(action).toHaveBeenCalledTimes(2))
    expect(sent(0).placement).toEqual({ kind: 'next-to', anchorItemId: 5, dir: 'above' })
    expect(sent(1).placement).toEqual({ kind: 'next-to', anchorItemId: first.id, dir: 'below' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps an end-of-sekcja placement at the end', async () => {
    const { user, fill, save } = renderDialog({ kind: 'end', sectionId: 3 })

    await keepOpen(user)
    await fill('Pierwsza praca')
    await save()
    await waitFor(() => expect(screen.getByLabelText('Opis pracy')).toHaveValue(''))
    await fill('Druga praca')
    await save()

    await waitFor(() => expect(action).toHaveBeenCalledTimes(2))
    expect(sent(1).placement).toEqual({ kind: 'end', sectionId: 3 })
  })

  it('closes after a save without it', async () => {
    const { fill, save, onClose } = renderDialog()

    await fill('Pierwsza praca')
    await save()

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})
