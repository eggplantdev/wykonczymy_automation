import {
  BIALOSTOCKA_RATES_HEADER,
  BIALOSTOCKA_LABOR_HEADER,
  PRZEDPOLE_LABOR_HEADER,
} from './header-blocks'

import { row } from './grid'

const sectionHeader = (name: string, netValue: number) =>
  row({ A: name, B: name, C: name, N: 'x', O: 'x', S: netValue })

// Białostocka's data rows: 10 etapy at D–M, Przedmiar N, j.m. P, Cena j.m. Q, rabat R (a fraction).
export const BIALOSTOCKA_ROWS: (string | number)[][] = [
  ...BIALOSTOCKA_LABOR_HEADER,
  sectionHeader('Prace dodatkowe', 12649),
  row({
    A: 'Prace dodatkowe',
    B: 5,
    C: 'zakup, transport i wniesienie towaru budowlanego',
    D: 0.5,
    E: 0.25,
    F: 0.25,
    N: 1,
    O: 1,
    P: 'kpl',
    Q: 1500,
    R: 0.09,
    S: 1365,
  }),
  // Przedmiar 0, executed 50 — offered nothing, did the work anyway. Must still become an item.
  row({
    A: 'Prace dodatkowe',
    B: 1,
    C: 'montaż płyt akustycznych dodatek',
    F: 50,
    N: 0,
    O: 50,
    P: 'm2',
    Q: 15,
    R: 0.09,
    S: 682.5,
  }),
  sectionHeader('Klimatyzacja', 13100),
  row({
    A: 'Klimatyzacja',
    B: 23,
    C: 'montaż jednostki wewnętrznej',
    D: 2,
    N: 2,
    O: 2,
    P: 'szt.',
    Q: 120,
    S: 240,
  }),
  // The footer: same „x" marker as a section header, no name anywhere, label in Q and value in S.
  row({ D: 'x', N: 'x', O: 'x', Q: 'wartość netto', S: 143089.489 }),
  row({ D: 'x', N: 'x', O: 'x', Q: 'R netto - suma prac  wykonannych ', S: 129036.359 }),
]

// Przedpole: 6 etapy at D–I, so Przedmiar is J and „Wartość netto" is O — the footer label lands in
// M. Nothing but the column indices differs, which is exactly what the parser must not hardcode.
export const PRZEDPOLE_ROWS: (string | number)[][] = [
  ...PRZEDPOLE_LABOR_HEADER,
  row({
    A: 'Prace dodatkowe',
    B: 'Prace dodatkowe',
    C: 'Prace dodatkowe',
    J: 'x',
    K: 'x',
    O: 5168,
  }),
  row({
    A: 'Prace dodatkowe',
    B: 5,
    C: 'zakup, transport i wniesienie towaru budowlanego',
    D: 0.5,
    F: 0.2,
    J: 1,
    K: 1,
    L: 'kpl',
    M: 1500,
    N: 0.05,
    O: 1425,
  }),
  row({ D: 'x', J: 'x', K: 'x', M: 'wartość netto', O: 91488.705 }),
  row({ D: 'x', J: 'x', K: 'x', M: 'R netto - suma prac  wykonannych ', O: 56753.475 }),
]

// The formula render is built alongside the values, since `typed` (hand-entered vs computed) is
// only visible there.
export function ratesTab(
  title: string,
  rates: ReadonlyArray<{
    description: string
    wTools: number | ''
    ownTools: number | ''
    typed?: boolean
    ownToolsFormula?: string
  }>,
): { title: string; grid: (string | number)[][]; formulas: (string | number)[][] } {
  return {
    title,
    grid: [
      ...BIALOSTOCKA_RATES_HEADER,
      ...rates.map(({ description, wTools, ownTools }) =>
        row({ B: description, R: wTools, T: ownTools }),
      ),
    ],
    formulas: [
      ...BIALOSTOCKA_RATES_HEADER,
      ...rates.map(({ description, wTools, ownTools, typed = false, ownToolsFormula }) =>
        row({
          B: description,
          R: typed ? wTools : '=Q4*0,65',
          T: ownToolsFormula ?? (typed ? ownTools : '=Q4*0,85'),
        }),
      ),
    ],
  }
}
