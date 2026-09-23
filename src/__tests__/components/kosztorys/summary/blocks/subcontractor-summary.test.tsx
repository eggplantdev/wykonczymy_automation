import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SubcontractorSummary } from '@/components/kosztorys/summary/blocks/subcontractor-summary'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import type { SubcontractorDueByPlaneT } from '@/lib/kosztorys/subcontractor-due'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'
import type { PayoutTransactionRowT } from '@/types/transfers'
import { bare } from '@/__tests__/helpers/money'

const INVESTMENT_ID = 4

const ANNA = 1
const BARTEK = 2
const CELINA = 3

const worker = (id: number, name: string): WorkerRefT => ({
  id,
  name,
  role: 'EMPLOYEE',
  email: `${name.toLowerCase()}@t.test`,
})

const WORKERS = [worker(ANNA, 'Anna'), worker(BARTEK, 'Bartek'), worker(CELINA, 'Celina')]

const stage = (id: number, workerId: number | null): KosztorysStageT => ({
  id,
  ordinal: id,
  label: null,
  plane: 'w_tools',
  workerId,
})

// Bartek ma przypisany etap, na którym nic jeszcze nie wykonano — to jego zaliczka, nie nadpłata.
const STAGES = [stage(1, ANNA), stage(2, BARTEK), stage(3, CELINA), stage(4, null)]

const DUE: SubcontractorDueByPlaneT = {
  // Deliberately NOT 5 000 / 4 000: those are the payout sum and the remainder, so a block that
  // rendered the plane split where the payout arithmetic belongs would print the same three figures.
  wTools: 6_500,
  ownTools: 2_500,
  combined: 9_000,
  hasUnconfirmedPlane: false,
  byStage: new Map(),
  byWorker: new Map([
    [ANNA, 6_000],
    [BARTEK, 0],
    [CELINA, 1_000],
    [null, 2_000],
  ]),
}

const PAYOUTS: PayoutTransactionRowT[] = [
  { workerId: ANNA, date: '2026-09-01', amount: 2_000, description: null },
  { workerId: BARTEK, date: '2026-09-02', amount: 500, description: null },
  { workerId: CELINA, date: '2026-09-03', amount: 2_500, description: null },
]

function renderBlock(showTransactions = true, due: SubcontractorDueByPlaneT = DUE) {
  render(
    <SubcontractorSummary
      investmentId={INVESTMENT_ID}
      subcontractorDue={due}
      payoutTransactions={PAYOUTS}
      stages={STAGES}
      workers={WORKERS}
      showGlobalSettings={false}
      showTransactions={showTransactions}
    />,
  )
}

// Siatka nie ma elementu wiersza — `display: contents` to jedyna klamra trzymająca cztery komórki
// jednej osoby razem.
const workerRow = (name: string) => screen.getByText(name).closest('div.contents') as HTMLElement

const moneyIn = (element: HTMLElement) => bare(element.textContent ?? '')

const tableOf = (caption: string) => screen.getByText(caption).closest('div.grid') as HTMLElement

// Komórki stoją bezpośrednio w siatce, bez elementu wiersza — kwoty jednego wiersza to sąsiedzi
// komórki etykiety, po kolei.
function amountsAfter(scope: HTMLElement, label: string): string[] {
  let cell = within(scope).getByText(label) as HTMLElement
  while (cell.parentElement && cell.parentElement !== scope) cell = cell.parentElement
  const amounts: string[] = []
  let next = cell.nextElementSibling
  while (next && amounts.length < 3) {
    amounts.push(moneyIn(next as HTMLElement))
    next = next.nextElementSibling
  }
  return amounts
}

// Pomylona atrybucja mówi o cudzych pieniądzach, a ujemne „pozostało" znaczy coś odwrotnego niż
// obiecuje nagłówek kolumny.
describe('Podsumowanie pracowników — czyj to dług', () => {
  it('prowadzi z wiersza na wypłaty tej jednej osoby', () => {
    renderBlock()

    expect(within(workerRow('Anna')).getByRole('link', { name: 'Anna' })).toHaveAttribute(
      'href',
      investmentTransfersHref(INVESTMENT_ID, { types: ['PAYOUT'], worker: ANNA }),
    )
  })

  // Reszta nieprzypisana nie jest osobą, więc nie ma czego filtrować — i nie wolno jej opisać
  // żadnym z trzech zdań o człowieku.
  it('zostawia resztę nieprzypisaną bez linku i bez wyjaśnienia', () => {
    renderBlock()

    const residual = workerRow('Bez przypisanego pracownika')
    expect(within(residual).queryByRole('link')).toBeNull()
    expect(within(residual).queryByText('Brak przypisanych etapów')).toBeNull()
    expect(within(residual).queryByText('Wypłacono więcej niż wykonano')).toBeNull()
  })

  it('nazywa nadpłatę nadpłatą', () => {
    renderBlock()

    const row = workerRow('Celina')
    expect(within(row).getByText('Wypłacono więcej niż wykonano')).toBeInTheDocument()
    expect(within(row).getByText('nadpłacone')).toBeInTheDocument()
  })

  // Zaliczka na etap, którego jeszcze nie zaczęto, wygląda w kwocie identycznie jak nadpłata. Gdyby
  // czytała się tak samo, blok krzyczałby przy każdej normalnej zaliczce.
  it('nie myli zaliczki na nierozpoczęty etap z nadpłatą', () => {
    renderBlock()

    const row = workerRow('Bartek')
    expect(within(row).getByText('Przypisane etapy bez wykonanych prac')).toBeInTheDocument()
    expect(within(row).queryByText('Wypłacono więcej niż wykonano')).toBeNull()
    expect(within(row).queryByText('Brak przypisanych etapów')).toBeNull()
  })

  // „Razem" stoi pod wierszami, więc czyta się jako ich suma — rozjazd z nagłówkiem obok znaczy, że
  // blok liczy dwiema regułami naraz.
  it('domyka wiersze tą samą trójką kwot, którą podaje nagłówek', () => {
    renderBlock()

    const workers = tableOf('Podsumowanie pracowników')
    const headline = tableOf('Podsumowanie podwykonawców')

    expect(amountsAfter(workers, 'Razem')).toEqual(['9000,00', '5000,00', '4000,00'])
    expect(amountsAfter(headline, 'Suma wykonanej pracy')[0]).toBe('9000,00')
    expect(amountsAfter(headline, 'Zaliczki (wypłaty)')[0]).toBe('5000,00')
    expect(amountsAfter(headline, 'Pozostało do wypłaty')[0]).toBe('4000,00')
  })
})

// Strona inwestycji ma listę transakcji obok panelu, więc rozbicie na płaszczyzny i tabela
// pracowników byłyby tam powtórzeniem — zostają trzy kwoty rozliczenia.
describe('Podsumowanie podwykonawców — host kompaktowy', () => {
  it('zostawia trzy kwoty, zdejmuje rozbicie i tabelę pracowników', () => {
    renderBlock(false)

    expect(screen.getByText('Suma wykonanej pracy')).toBeInTheDocument()
    expect(screen.getByText('Zaliczki (wypłaty)')).toBeInTheDocument()
    expect(screen.getByText('Pozostało do wypłaty')).toBeInTheDocument()
    expect(screen.queryByText('Podsumowanie pracowników')).toBeNull()
    expect(screen.queryByText('Z narzędziami (podwykonawca)')).toBeNull()
    expect(screen.queryByText('Lista wpłat')).toBeNull()
  })

  it('pokazuje rozbicie na płaszczyzny w pełnym widoku', () => {
    renderBlock()

    expect(screen.getByText('Z narzędziami (podwykonawca)')).toBeInTheDocument()
    expect(screen.getByText('Bez narzędzi (pracownik)')).toBeInTheDocument()
  })
})

// Etap bez potwierdzonego rozliczenia nie wchodzi do żadnej płaszczyzny, więc „Suma wykonanej pracy"
// jest zaniżona — bez znaku obok kwoty nikt nie ma powodu szukać, czego w niej brakuje.
describe('Podsumowanie podwykonawców — niepotwierdzone rozliczenie etapu', () => {
  it('znakuje sumę wykonanej pracy, gdy któryś etap nie ma rozliczenia', () => {
    renderBlock(true, { ...DUE, hasUnconfirmedPlane: true })

    const row = tableOf('Podsumowanie podwykonawców')
    expect(within(row).getByLabelText('Rozliczenie etapu niepotwierdzone')).toBeInTheDocument()
  })

  it('nie znakuje niczego, gdy każdy etap ma rozliczenie', () => {
    renderBlock()

    expect(screen.queryByLabelText('Rozliczenie etapu niepotwierdzone')).toBeNull()
  })
})
