import { render, screen, within } from '@testing-library/react'
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

describe('CompanyKnowledgeButton', () => {
  beforeEach(() => {
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
})
