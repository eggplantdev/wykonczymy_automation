import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompanyKnowledgeButton } from '@/components/company-knowledge/company-knowledge-button'
import type { CompanyKnowledgeEntryT } from '@/types/company-knowledge'

const state = vi.hoisted(() => ({
  role: 'MANAGER',
  entries: [] as CompanyKnowledgeEntryT[],
}))
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: 1, email: 'm@example.test', name: 'Testowy', role: state.role }),
}))
vi.mock('@/lib/queries/company-knowledge', () => ({
  fetchCompanyKnowledge: vi.fn(async () => ({ success: true, data: state.entries })),
}))
const actions = vi.hoisted(() => ({
  createCompanyKnowledgeAction: vi.fn(),
  updateCompanyKnowledgeAction: vi.fn(),
  deleteCompanyKnowledgeAction: vi.fn(),
  reorderCompanyKnowledgeAction: vi.fn(),
}))
vi.mock('@/lib/actions/company-knowledge', () => actions)
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const entry = (id: number, topic: string, content: string): CompanyKnowledgeEntryT => ({
  id,
  topic,
  content,
  updatedAt: '2026-10-08T10:00:00.000Z',
})

const BOOK = [
  entry(3, 'Wysokość pomieszczeń', 'Stan deweloperski: 2,68 m.'),
  entry(1, 'Bruzdy wod-kan', 'Łazienka: ok. 2 mb.'),
  entry(2, 'Akrylowanie', 'Styk płytek z sufitem.'),
]

const topics = () =>
  within(screen.getByRole('dialog'))
    .queryAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent)

const grips = () => document.querySelectorAll('.lucide-grip-vertical')

async function openBook() {
  const user = userEvent.setup()
  render(<CompanyKnowledgeButton />)
  await user.click(screen.getByRole('button', { name: 'Wiedza firmowa' }))
  await screen.findByRole('dialog')
  return user
}

const REFUSED = { success: false, error: 'Błąd bazy danych', code: 'DATABASE_ERROR' } as const

async function openLoadedBook() {
  const user = await openBook()
  await screen.findByText('Wysokość pomieszczeń')
  return user
}

async function typeEntry(user: ReturnType<typeof userEvent.setup>, topic: string, content: string) {
  const topicField = screen.getByPlaceholderText('Temat')
  const contentField = screen.getByPlaceholderText('Treść')
  await user.clear(topicField)
  await user.type(topicField, topic)
  await user.clear(contentField)
  await user.type(contentField, content)
  await user.click(screen.getByRole('button', { name: 'Zapisz' }))
}

describe('CompanyKnowledgeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.role = 'MANAGER'
    state.entries = BOOK
  })

  it('renders nothing for an EMPLOYEE', () => {
    state.role = 'EMPLOYEE'
    const { container } = render(<CompanyKnowledgeButton />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens on the entries in their own order', async () => {
    await openBook()
    expect(await screen.findByText('Wysokość pomieszczeń')).toBeInTheDocument()
    expect(topics()).toEqual(['Wysokość pomieszczeń', 'Bruzdy wod-kan', 'Akrylowanie'])
    expect(grips()).toHaveLength(3)
  })

  it('says the book is empty when it is', async () => {
    state.entries = []
    await openBook()
    expect(await screen.findByText('Brak wpisów')).toBeInTheDocument()
  })

  it('finds „Łazienka” when searched without Polish letters, and stops offering the drag', async () => {
    const user = await openBook()
    await screen.findByText('Wysokość pomieszczeń')
    await user.type(screen.getByPlaceholderText('Szukaj w tematach i treści'), 'lazienka')
    expect(topics()).toEqual(['Bruzdy wod-kan'])
    expect(grips()).toHaveLength(0)
  })

  it('sorts alphabetically without a grip', async () => {
    const user = await openBook()
    await screen.findByText('Wysokość pomieszczeń')
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Alfabetycznie' }))
    expect(topics()).toEqual(['Akrylowanie', 'Bruzdy wod-kan', 'Wysokość pomieszczeń'])
    expect(grips()).toHaveLength(0)
  })

  it('puts a created entry on top once the server has given it an id', async () => {
    actions.createCompanyKnowledgeAction.mockResolvedValue({ success: true, data: { id: 9 } })
    const user = await openLoadedBook()
    await user.click(screen.getByRole('button', { name: 'Dodaj wpis' }))
    await typeEntry(user, 'Gruz', 'Dwa big bagi na łazienkę.')
    expect(await screen.findByText('Gruz')).toBeInTheDocument()
    expect(topics()[0]).toBe('Gruz')
    expect(screen.queryByPlaceholderText('Temat')).not.toBeInTheDocument()
    expect(grips()).toHaveLength(4)
  })

  it('keeps the typed entry in the form when the server refuses it', async () => {
    actions.createCompanyKnowledgeAction.mockResolvedValue(REFUSED)
    const user = await openLoadedBook()
    await user.click(screen.getByRole('button', { name: 'Dodaj wpis' }))
    await typeEntry(user, 'Gruz', 'Dwa big bagi na łazienkę.')
    expect(await screen.findByDisplayValue('Gruz')).toBeInTheDocument()
    expect(topics()).toEqual(['Wysokość pomieszczeń', 'Bruzdy wod-kan', 'Akrylowanie'])
  })

  it('puts a refused edit back and reopens the form with what was typed', async () => {
    actions.updateCompanyKnowledgeAction.mockResolvedValue(REFUSED)
    const user = await openLoadedBook()
    await user.click(screen.getAllByRole('button', { name: 'Edytuj wpis' })[0])
    await typeEntry(user, 'Wysokość', 'Zawsze 2,70 m.')
    expect(await screen.findByDisplayValue('Zawsze 2,70 m.')).toBeInTheDocument()
    expect(topics()).toEqual(['Bruzdy wod-kan', 'Akrylowanie'])
    await user.click(screen.getByRole('button', { name: /Anuluj|Cancel/ }))
    expect(topics()).toEqual(['Wysokość pomieszczeń', 'Bruzdy wod-kan', 'Akrylowanie'])
  })

  it('reloads the book when the entry was already deleted elsewhere', async () => {
    actions.deleteCompanyKnowledgeAction.mockResolvedValue({
      success: false,
      error: 'Nie znaleziono',
      code: 'NOT_FOUND',
    })
    const user = await openLoadedBook()
    state.entries = [BOOK[2]]
    await user.click(screen.getAllByRole('button', { name: 'Usuń wpis' })[1])
    await user.click(await screen.findByRole('button', { name: 'Usuń' }))
    await waitFor(() => expect(topics()).toEqual(['Akrylowanie']))
  })
})
