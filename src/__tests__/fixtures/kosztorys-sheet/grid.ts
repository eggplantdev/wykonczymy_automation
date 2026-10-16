const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function col(letter: string): number {
  return letter.length === 1
    ? A.indexOf(letter)
    : (A.indexOf(letter[0]) + 1) * 26 + A.indexOf(letter[1])
}

export function row(cells: Record<string, string | number>): (string | number)[] {
  const indexed = Object.entries(cells).map(([letter, value]) => [col(letter), value] as const)
  const width = Math.max(...indexed.map(([index]) => index)) + 1
  const out = Array<string | number>(width).fill('')
  for (const [index, value] of indexed) out[index] = value
  return out
}
