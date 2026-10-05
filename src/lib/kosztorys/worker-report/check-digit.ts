// Damm's quasigroup: unlike a mod-10 sum it catches every single-digit error AND every swap of two
// neighbouring digits — the two ways a handwriting or OCR misread turns one pozycja's number into
// another's.
const DAMM_TABLE = [
  [0, 3, 1, 7, 5, 9, 8, 6, 4, 2],
  [7, 0, 9, 2, 1, 5, 4, 8, 6, 3],
  [4, 2, 0, 6, 8, 7, 1, 3, 5, 9],
  [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
  [6, 1, 2, 3, 0, 4, 5, 9, 7, 8],
  [3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
  [5, 8, 6, 9, 7, 2, 0, 1, 3, 4],
  [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
  [9, 4, 3, 8, 6, 1, 7, 2, 0, 5],
  [2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
] as const

const dammInterim = (digits: string): number => {
  let interim = 0
  for (const digit of digits) interim = DAMM_TABLE[interim][Number(digit)]
  return interim
}

export const dammDigit = (value: number): number => dammInterim(String(value))

export const formatFormRef = (ref: number): string => `${ref}-${dammDigit(ref)}`

const FORM_REF = /^(\d+)-(\d)$/

/** The pozycja number a printed „35812-7" stands for — undefined when the check digit disagrees. */
export function parseFormRef(text: string): number | undefined {
  const match = FORM_REF.exec(text.trim())
  if (!match) return undefined
  // Damm over the number followed by its check digit is 0 exactly when the digit is right.
  if (dammInterim(match[1] + match[2]) !== 0) return undefined
  return Number(match[1])
}
