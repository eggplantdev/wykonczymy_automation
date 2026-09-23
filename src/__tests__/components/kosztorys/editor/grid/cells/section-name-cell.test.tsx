import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SectionNameCell,
  sectionNameColumn,
} from '@/components/kosztorys/editor/grid/cells/section-name-cell'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

const SECTION_ID = 7
const ENTRY_NAME = 'Kuchnia'

const ROW = { id: 1, sectionId: SECTION_ID, sectionName: ENTRY_NAME } as KosztorysV2RowT

const onRename = vi.fn()
const stopEditing = vi.fn()

type CellPropsT = Partial<Parameters<typeof SectionNameCell>[0]>

// A neighbour to tab into: blur is the only commit path, so every test needs somewhere for the
// caret to land. Built as a tree rather than inline per test, so a rerender cannot drift from the
// render it is meant to be the next frame of.
const tree = (props: CellPropsT = {}) => (
  <>
    <SectionNameCell rowData={ROW} onRename={onRename} {...props} />
    <button type="button">obok</button>
  </>
)

function renderCell(props: CellPropsT = {}) {
  return { ...render(tree(props)), user: userEvent.setup() }
}

beforeEach(() => vi.clearAllMocks())

describe('Sekcja — zmiana nazwy w komórce', () => {
  it('zapisuje nazwę na wyjściu z komórki, dla całej sekcji a nie dla wiersza', async () => {
    const { user } = renderCell()
    const input = screen.getByRole('textbox')

    await user.click(input)
    await user.clear(input)
    await user.type(input, 'Łazienka')
    await user.tab()

    expect(onRename).toHaveBeenCalledExactlyOnceWith(SECTION_ID, 'Łazienka')
  })

  it('zatwierdza Enterem dokładnie raz', async () => {
    const { user } = renderCell()
    const input = screen.getByRole('textbox')

    await user.click(input)
    await user.clear(input)
    await user.type(input, 'Salon{Enter}')

    expect(onRename).toHaveBeenCalledExactlyOnceWith(SECTION_ID, 'Salon')
  })
})

// Focus alone opens editing, so without the guard tabbing through the cell writes an unchanged name
// — a revalidation and an undo-history entry for nothing.
describe('Sekcja — wyjście, które niczego nie zmieniło', () => {
  it('nie zapisuje niczego, gdy ktoś tylko przeszedł przez komórkę', async () => {
    const { user } = renderCell()

    await user.tab()
    expect(screen.getByRole('textbox')).toHaveFocus()
    await user.tab()

    expect(onRename).not.toHaveBeenCalled()
  })

  it('nie zapisuje niczego, gdy nazwa wróciła do tej, od której zaczęto', async () => {
    const { user } = renderCell()
    const input = screen.getByRole('textbox')

    await user.click(input)
    await user.type(input, ' remont')
    await user.clear(input)
    await user.type(input, ENTRY_NAME)
    await user.tab()

    expect(onRename).not.toHaveBeenCalled()
  })

  it('porzuca edycję po Escape i pokazuje z powrotem nazwę sekcji', async () => {
    const { user } = renderCell()
    const input = screen.getByRole('textbox')

    await user.click(input)
    await user.clear(input)
    await user.type(input, 'Strych{Escape}')

    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue(ENTRY_NAME)
  })
})

describe('Sekcja — nazwa zmieniona spoza siatki', () => {
  // Outside editing the cell shows the name off the row, not the last draft — otherwise a change
  // made from the sekcja panel would hide behind abandoned text until a reload.
  it('pokazuje nazwę nadaną z panelu, nie porzucony szkic', async () => {
    const { user, rerender } = renderCell()
    const input = screen.getByRole('textbox')

    await user.click(input)
    await user.clear(input)
    await user.type(input, 'Strych{Escape}')

    rerender(tree({ rowData: { ...ROW, sectionName: 'Kuchnia i jadalnia' } as KosztorysV2RowT }))

    expect(screen.getByRole('textbox')).toHaveValue('Kuchnia i jadalnia')
  })

  it('nie daje pola do pisania tam, gdzie kosztorys jest tylko do czytania', () => {
    renderCell({ disabled: true })

    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText(ENTRY_NAME)).toBeInTheDocument()
  })
})

// Delete on a selected Sekcja cell is a grid gesture, not an edit — one press would otherwise clear
// the sekcja's name across all of its rows.
describe('Sekcja — Delete na zaznaczonej komórce', () => {
  it('oddaje wiersz nietknięty', () => {
    const column = sectionNameColumn('Sekcja', onRename)

    expect(column.deleteValue?.({ rowData: ROW, rowIndex: 0 })).toEqual(ROW)
  })
})

// In the grid the cell is gated on dsg's editing flag, because an input renders one line whatever
// the row's height — the name has to be TEXT at rest for „Dopasuj wysokość wierszy" to reach it.
// The band passes no flag at all and keeps its permanently live input, covered by the suites above.
describe('Sekcja — komórka siatki poza edycją', () => {
  const renderGridCell = (focus: boolean) => renderCell({ focus, stopEditing })

  it('pokazuje nazwę jako tekst, który może się zawinąć', () => {
    renderGridCell(false)

    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText(ENTRY_NAME)).toBeInTheDocument()
  })

  it('daje pole do pisania dopiero w edycji', () => {
    renderGridCell(true)

    expect(screen.getByRole('textbox')).toHaveValue(ENTRY_NAME)
  })

  // Clicking another cell is the path that ends an edit through React alone, so this is the one exit
  // the cell — not the hook's own cleanup — has to survive.
  it('zapisuje nazwę, gdy siatka kończy edycję bez bluru', async () => {
    const { rerender, user } = renderGridCell(true)

    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Pralnia')

    rerender(tree({ focus: false, stopEditing }))

    expect(onRename).toHaveBeenCalledExactlyOnceWith(SECTION_ID, 'Pralnia')
  })

  // `enterEscapeKeyDown` swallows both keys, and dsg listens on `document` — so nothing else can tell
  // the grid the edit ended. Without the handover it keeps `editing` true over a blurred input, and
  // the next character reaches neither of them.
  it('oddaje komórkę siatce po Enterze', async () => {
    const { user } = renderGridCell(true)

    await user.type(screen.getByRole('textbox'), '{Enter}')

    expect(stopEditing).toHaveBeenCalledExactlyOnceWith({ nextRow: true })
  })

  // A cancelled edit must leave the cursor where it was — dsg's own default walks it down a row.
  it('oddaje komórkę siatce po Escapie, bez schodzenia wiersz niżej', async () => {
    const { user } = renderGridCell(true)

    await user.type(screen.getByRole('textbox'), '{Escape}')

    expect(stopEditing).toHaveBeenCalledExactlyOnceWith({ nextRow: false })
    expect(onRename).not.toHaveBeenCalled()
  })
})
